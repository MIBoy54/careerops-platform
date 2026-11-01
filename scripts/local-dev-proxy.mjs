// Docker publishes only 127.0.0.1:3000. Keep the actual DEV server on loopback.
import net from 'node:net';
import { spawn } from 'node:child_process';
const app = spawn(process.execPath, ['scripts/start-dev.js'], {
  env: { ...process.env, PORT: '3001' }, stdio: 'inherit'
});
const proxy = net.createServer(client => {
  const target = net.connect(3001, '127.0.0.1');
  client.on('error', () => target.destroy());
  target.on('error', () => client.destroy());
  client.pipe(target).pipe(client);
});
proxy.listen(3000, '0.0.0.0');
proxy.on('error', () => { app.kill('SIGTERM'); process.exitCode = 1; });
app.on('exit', code => { proxy.close(); process.exit(code ?? 1); });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.kill(signal));
