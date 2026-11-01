#!/usr/bin/env python3
"""Persistent isolated CareerOps DEV. No production bindings, destructive reset, or secret output."""
import argparse, json, os, secrets, subprocess, sys, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path.home()/'.config/careerops-dev'
LABEL = 'org.careerops.local-dev=v1'
DB = 'careerops-local-dev-mysql'
APP = 'careerops-local-dev-app'
VOLUME = 'careerops-local-dev-data'
NETWORK = 'careerops-local-dev'
MYSQL = 'mysql@sha256:a0225d1ea6631c8bc2385dc4c2faba17bbf1834ecf369e1659a9a382bd8d5dd7'
NODE = 'node@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0'
def run(*args, capture=False, check=True, timeout=120):
    return subprocess.run(args, text=True, capture_output=capture, check=check, timeout=timeout)
def inspect(kind, name):
    p=run('docker',kind,'inspect',name,capture=True,check=False)
    if p.returncode: return None
    return json.loads(p.stdout)[0]
def owned(kind,name):
    info=inspect(kind,name)
    if info:
        labels=info.get('Config',{}).get('Labels',{}) if kind=='container' else info.get('Labels',{})
        if (labels or {}).get('org.careerops.local-dev')!='v1':
            raise RuntimeError('Refusing unowned resource: '+name)
    return info
def private_file(name, value):
    fd=os.open(CONFIG/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as stream: stream.write(value)
def capacity():
    import shutil
    if min(shutil.disk_usage(ROOT).free,shutil.disk_usage('/mnt/c').free)<3*1024**3:
        raise RuntimeError('Insufficient storage headroom; preserve 1.5 GB reserve')
def ready():
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        result=run('docker','exec',DB,'sh','-ec',
          'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names -e "SELECT @@GLOBAL.skip_networking"',
          capture=True,check=False,timeout=6)
        if result.returncode==0 and result.stdout.strip()=='0': return
        time.sleep(1)
    raise RuntimeError('MySQL final-server readiness timeout')
def ensure_database():
    capacity()
    for kind,name in [('network',NETWORK),('volume',VOLUME)]:
        if not owned(kind,name): run('docker',kind,'create','--label',LABEL,name,capture=True)
    info=owned('container',DB)
    if not info:
        run('docker','run','-d','--name',DB,'--label',LABEL,'--restart','unless-stopped',
            '--network',NETWORK,'--publish','127.0.0.1:3000:3000',
            '--mount','type=volume,source='+VOLUME+',target=/var/lib/mysql',
            '--env-file',str(CONFIG/'mysql.env'),MYSQL,'--partial-revokes=OFF',capture=True)
    elif not info['State']['Running']: run('docker','start',DB,capture=True)
    ready()
def remove_app():
    if owned('container',APP): run('docker','rm','-f',APP,capture=True)
def start_app():
    commit=run('git','-C',str(ROOT),'rev-parse','HEAD',capture=True).stdout.strip()
    envpath=CONFIG/'app.env'
    envlines=[line for line in envpath.read_text().splitlines() if not line.startswith('BUILD_COMMIT_SHA=')]
    envpath.write_text('\n'.join(envlines+['BUILD_COMMIT_SHA='+commit])+'\n')
    envpath.chmod(0o600)
    remove_app()
    run('docker','run','-d','--init','--name',APP,'--label',LABEL,'--restart','unless-stopped',
      '--network','container:'+DB,'--env-file',str(CONFIG/'app.env'),
      '--mount','type=bind,source='+str(ROOT)+',target=/work,readonly',
      '--workdir','/work',NODE,'node','scripts/local-dev-proxy.mjs',capture=True)
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=2) as r:
                if r.status==200: print('DEV ready: http://127.0.0.1:3000'); return
        except Exception: time.sleep(1)
    raise RuntimeError('DEV startup timeout; inspect local app logs')
def init():
    if CONFIG.exists(): raise RuntimeError('Configuration already exists; inspect status, do not bootstrap again')
    if any(inspect(k,n) for k,n in [('container',DB),('container',APP),('volume',VOLUME),('network',NETWORK)]):
        raise RuntimeError('DEV resource names occupied; review rather than overwrite')
    capacity()
    CONFIG.mkdir(mode=0o700,parents=True)
    root,app,login,session=[secrets.token_urlsafe(36) for _ in range(4)]
    private_file('provision.json',json.dumps({'root':root,'login':login,'email':'dev-admin@example.invalid'}))
    private_file('mysql.env','MYSQL_ROOT_PASSWORD='+root+'\n')
    commit=run('git','-C',str(ROOT),'rev-parse','HEAD',capture=True).stdout.strip()
    private_file('app.env','\n'.join(['APP_ENV=dev','DB_NAME=careerops_dev','DB_HOST=127.0.0.1',
      'DB_PORT=3306','DB_USER=careerops_app','DB_PASSWORD='+app,'SESSION_SECRET='+session,
      'SESSION_TREND_SOURCE_TIME_ZONE=+00:00','BUILD_COMMIT_SHA='+commit,'DEMO_MODE=false'])+'\n')
    private_file('login.json',json.dumps({'email':'dev-admin@example.invalid','password':login}))
    for image in [MYSQL,NODE]: run('docker','pull',image,timeout=300)
    ensure_database()
    p=run('docker','run','--rm','--network','container:'+DB,'--env-file',str(CONFIG/'app.env'),
      '--mount','type=bind,source='+str(ROOT)+',target=/work,readonly',
      '--mount','type=bind,source='+str(CONFIG/'provision.json')+',target=/run/careerops/provision.json,readonly',
      '--workdir','/work',NODE,'node','scripts/local-dev-provision.mjs',capture=True)
    result=json.loads(p.stdout.strip().splitlines()[-1])
    private_file('initialized.json',json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
    start_app()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['init','start','stop','status','restart-app','restart-db','recreate-db','logs'])
    a=p.parse_args().action
    if a=='init': return init()
    if not (CONFIG/'initialized.json').exists(): raise RuntimeError('No verified initialized DEV state; inspect partial setup before retrying')
    if a in ['start','restart-app']: ensure_database(); start_app()
    elif a in ['restart-db','recreate-db']:
        remove_app()
        if not owned('container',DB): raise RuntimeError('Expected owned database container')
        if a=='restart-db': run('docker','restart',DB,capture=True)
        else:
            run('docker','rm','-f',DB,capture=True)
            ensure_database() # Reuses the named volume; never calls bootstrap.
        ready(); start_app()
    elif a=='stop':
        for name in [APP,DB]:
            if owned('container',name): run('docker','stop',name,capture=True)
        print('DEV stopped; database volume and credentials retained')
    elif a=='logs': run('docker','logs','--tail','60',APP)
    elif a=='status':
        print(json.dumps({'url':'http://127.0.0.1:3000','config':str(CONFIG),
          'containers':{n:(owned('container',n) or {}).get('State',{}).get('Status','absent') for n in [DB,APP]},
          'volume':VOLUME},indent=2))
if __name__=='__main__':
    try: main()
    except Exception as e:
        # Do not print driver output, process environments, or credential-bearing args.
        print('DEV operation failed: '+type(e).__name__+'. Inspect local state; no automatic bootstrap retry.',file=sys.stderr)
        sys.exit(1)
