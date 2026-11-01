import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const moduleUrl = new URL('../../scripts/dev-bootstrap.js', import.meta.url).href;
const promptPublication = '    output.write(`${label}: `);\n';
// Only nonsecret canaries enter this real terminal. A separate pipe carries
// synchronization/results; neither pipe contains environment or database data.
const program = `
import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hiddenInput } from ${JSON.stringify(moduleUrl)};
const events = Number(process.env.P2_EVENTS);
const ack = Number(process.env.P2_ACK);
const report = value => fs.writeSync(events, JSON.stringify(value) + '\\n');
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, ...args) {
  const result = originalWrite(chunk, ...args);
  if (String(chunk) === 'Nonsecret canary: ') {
    report({ event: 'prompt', raw: process.stdin.isRaw });
    // Hold the child exactly at prompt publication until input has been sent.
    fs.readSync(ack, Buffer.alloc(1), 0, 1, null);
  }
  return result;
};
let prompt = hiddenInput;
if (process.env.P2_VARIANT === 'old-order') {
  const file = fs.readFileSync(new URL(${JSON.stringify(moduleUrl)}), 'utf8');
  let source = file.slice(file.indexOf('export function hiddenInput('), file.indexOf('\\nexport async function runCli('));
  const publication = ${JSON.stringify(promptPublication)};
  if (!source.includes(publication)) throw new Error('Negative control no longer matches source.');
  source = source.replace(publication, '').replace('  return new Promise', '  ' + publication.trimStart() + '  return new Promise');
  source = source.replace('export function hiddenInput', 'return function hiddenInput');
  prompt = new Function('createInterface', 'Writable', source)(createInterface, Writable);
}
try {
  const value = await prompt('Nonsecret canary');
  report({ event: 'result', accepted: value === 'NONSECRET_CANARY', cancelled: false });
} catch (error) {
  report({ event: 'result', accepted: false, cancelled: error.message === 'Input cancelled.' });
}
`;

// Python's standard library supplies the kernel PTY without a new npm dependency.
// This Linux-specific test fails if python3 is unavailable; other platforms skip.
const harness = String.raw`
import json, os, pty, select, signal, subprocess, sys, termios, time
config = json.load(sys.stdin)
master, slave = pty.openpty()
events_read, events_write = os.pipe()
ack_read, ack_write = os.pipe()
fds = {master, slave, events_read, events_write, ack_read, ack_write}
before = termios.tcgetattr(slave)
child = None
outcome = {}

def terminate(_signal, _frame):
    raise TimeoutError('Outer PTY watchdog expired')

def close(fd):
    os.close(fd)
    fds.remove(fd)

signal.signal(signal.SIGTERM, terminate)
try:
    env = {'PATH': os.environ.get('PATH', ''), 'P2_EVENTS': str(events_write),
           'P2_ACK': str(ack_read), 'P2_VARIANT': config['variant']}
    # Defer SIGTERM until Popen has returned an owned child handle.
    mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
    try:
        child = subprocess.Popen([config['node'], '--input-type=module', '-e', config['program']],
            stdin=slave, stdout=slave, stderr=slave, pass_fds=(events_write, ack_read),
            start_new_session=True, env=env)
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, mask)
    close(events_write)
    close(ack_read)
    os.set_blocking(master, False)
    os.set_blocking(events_read, False)
    output, messages = bytearray(), bytearray()
    sent, announced, acknowledged = False, False, False
    echo_at_prompt, echo_before_ack = None, False
    deadline = time.monotonic() + 5
    while True:
        if time.monotonic() > deadline:
            raise TimeoutError('Inner PTY deadline expired')
        ready, _, _ = select.select([master, events_read], [], [], 0.05)
        for descriptor in ready:
            try:
                data = os.read(descriptor, 65536)
            except (OSError, BlockingIOError):
                data = b''
            (output if descriptor == master else messages).extend(data)
        if not announced and b'Nonsecret canary: ' in output and b'"event":"prompt"' in messages:
            echo_at_prompt = bool(termios.tcgetattr(slave)[3] & termios.ECHO)
            print(json.dumps({'event': 'ready'}), flush=True)
            announced = True
            if config['variant'] == 'inner-timeout':
                deadline = time.monotonic() - 1
            elif config['variant'] != 'outer-timeout':
                os.write(master, bytes(config['input']))
                sent = True
        # For the old-order control, do not let readline initialize until actual
        # kernel echo has been captured. This is an event barrier, not a sleep.
        if sent and not acknowledged:
            echo_before_ack = b'NONSECRET_CANARY' in output
            if config['variant'] != 'old-order' or echo_before_ack:
                os.write(ack_write, b'1')
                acknowledged = True
        if child.poll() is not None:
            for descriptor, target in [(master, output), (events_read, messages)]:
                while select.select([descriptor], [], [], 0)[0]:
                    try:
                        data = os.read(descriptor, 65536)
                    except (OSError, BlockingIOError):
                        break
                    if not data:
                        break
                    target.extend(data)
            break
    records = [json.loads(line) for line in messages.splitlines()]
    outcome = {'timeout': False, 'sent': sent, 'echo_at_prompt': echo_at_prompt,
        'raw_at_prompt': next(row['raw'] for row in records if row['event'] == 'prompt'),
        'canary_in_output': b'NONSECRET_CANARY' in output, 'echo_before_ack': echo_before_ack,
        'restored': termios.tcgetattr(slave) == before, 'exit': child.returncode,
        'result': next(row for row in records if row['event'] == 'result')}
except TimeoutError:
    outcome = {'timeout': True}
finally:
    if child is not None:
        if child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        child.wait()
        outcome['child_pid'] = child.pid
        outcome['child_reaped'] = child.returncode is not None
    # On forced timeout the killed child cannot restore its terminal itself.
    # Positive cases check natural restoration above, before this safety cleanup.
    termios.tcsetattr(slave, termios.TCSANOW, before)
    outcome['cleanup_restored'] = termios.tcgetattr(slave) == before
    for descriptor in list(fds):
        close(descriptor)
print(json.dumps({'event': 'complete', **outcome}), flush=True)
`;

async function checkPty(input, variant = 'current') {
  return new Promise((resolve, reject) => {
    const harnessProcess = spawn('python3', ['-c', harness], {
      stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH }
    });
    let stdout = '', stderr = '', timedOut = false, readyTimerArmed = false;
    // SIGTERM is handled by Python: it kills/reaps its child in finally. Never
    // SIGKILL the harness first or return before its close event reaps Python.
    const expire = () => { timedOut = true; harnessProcess.kill('SIGTERM'); };
    let timer = setTimeout(expire, 8000);
    harnessProcess.stdout.on('data', chunk => {
      stdout += chunk;
      if (variant === 'outer-timeout' && !readyTimerArmed && stdout.includes('"event": "ready"')) {
        readyTimerArmed = true;
        clearTimeout(timer);
        timer = setTimeout(expire, 1); // Child is already blocked at the barrier.
      }
    });
    harnessProcess.stderr.on('data', chunk => { stderr += chunk; });
    harnessProcess.once('error', error => { clearTimeout(timer); reject(error); });
    harnessProcess.once('close', code => {
      clearTimeout(timer);
      try {
        expect(code, stderr).toBe(0);
        const result = stdout.trim().split('\n').map(line => JSON.parse(line)).find(row => row.event === 'complete');
        expect(result, stderr).toBeDefined();
        expect(result.child_reaped).toBe(true);
        expect(result.cleanup_restored).toBe(true);
        for (const pid of [result.child_pid, harnessProcess.pid]) {
          expect(pid).toBeGreaterThan(0);
          let error;
          try { process.kill(pid, 0); } catch (caught) { error = caught; }
          expect(error?.code).toBe('ESRCH');
        }
        resolve({ ...result, outer_timeout: timedOut });
      } catch (error) { reject(error); }
    });
    harnessProcess.stdin.on('error', error => {
      // An early harness failure can close stdin; close/error above reports it.
      if (error.code !== 'EPIPE') stderr += error.message;
    });
    harnessProcess.stdin.end(JSON.stringify({ node: process.execPath, program, variant, input: [...Buffer.from(input)] }));
  });
}

describe.skipIf(process.platform !== 'linux')('hidden input on a real Linux PTY', () => {
  it.each([
    ['immediate input', 'NONSECRET_CANARY\r', false],
    ['backspace editing', 'NONSECRET_CANARYX\x7f\r', false],
    ['Ctrl+C cancellation', 'NONSECRET_CANARY\x03', true]
  ])('disables echo before %s and restores the terminal', async (_name, input, cancelled) => {
    const result = await checkPty(input);
    expect(result.sent).toBe(true);
    expect(result.echo_at_prompt).toBe(false);
    expect(result.raw_at_prompt).toBe(true);
    expect(result.canary_in_output).toBe(false);
    expect(result.restored).toBe(true);
    expect(result.exit).toBe(0);
    expect(result.result).toEqual({ event: 'result', accepted: !cancelled, cancelled });
  }, 10000);

  it('detects the old prompt-before-initialization order as a negative control', async () => {
    const result = await checkPty('NONSECRET_CANARY\r', 'old-order');
    expect(result.sent).toBe(true);
    expect(result.echo_at_prompt).toBe(true);
    expect(result.raw_at_prompt).not.toBe(true);
    expect(result.echo_before_ack).toBe(true);
    expect(result.canary_in_output).toBe(true);
    expect(result.result).toEqual({ event: 'result', accepted: true, cancelled: false });
    expect(result.restored).toBe(true);
    expect(result.exit).toBe(0);
  }, 10000);
  it.each(['inner-timeout', 'outer-timeout'])('terminates and reaps both processes on %s', async variant => {
    const result = await checkPty('', variant);
    expect(result.timeout).toBe(true);
    expect(result.child_reaped).toBe(true);
    expect(result.cleanup_restored).toBe(true);
    expect(result.outer_timeout).toBe(variant === 'outer-timeout');
  }, 10000);
});
