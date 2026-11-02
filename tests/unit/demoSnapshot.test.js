import { describe, it, expect, vi } from 'vitest';
import { protectSnapshot, snapshotConfig, captureSnapshot, createSnapshotSource,
  fetchSnapshot, createGuestSnapshots, snapshotBusinessRead, createReadOnlySnapshotPool } from '../../src/demoSnapshot.js';

const raw = () => ({ schemaVersion:1, capturedAt:new Date().toISOString(),
  contacts:[{id:1,company:'Example employer',reported_to_unemployment:'Yes',notes:'PRIVATE',
    recruiter_name:'PRIVATE',email:'PRIVATE',phone:'PRIVATE',address:'PRIVATE',website:'PRIVATE',unknown:'PRIVATE'}],
  reports:[{id:2,week_start:'2026-01-04',week_end:'2026-01-10',submitted:1,notes:'PRIVATE'}],
  links:[{report_id:2,recruiter_tracker_id:1,unknown:'PRIVATE'}] });
const response = () => ({ code:200, headers:{}, status(n){this.code=n;return this;},
  json(data){this.data=data;return this;},send(data){this.data=data;return this;},
  setHeader(k,v){this.headers[k]=v;},type(){},attachment(){} });

describe('protected LIVE snapshot', () => {
  it('removes protected and unknown fields before storage or serialization', () => {
    const result=protectSnapshot(raw());
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(result.contacts[0].recruiter_name).toBe('Protected contact');
    expect(result.contacts[0].reported_unemployment).toBe('Yes');
  });
  it('refuses dangling report links rather than publishing partial data', () => {
    const value=raw();value.links[0].recruiter_tracker_id=99;
    expect(()=>protectSnapshot(value)).toThrow('incomplete');
  });
  it('is disabled by default and rejects unsafe enabled configuration', () => {
    expect(snapshotConfig({},'demo')).toBeNull();
    expect(()=>snapshotConfig({DEMO_ENTRY_SNAPSHOT_ENABLED:'true'},'dev')).toThrow();
    expect(()=>snapshotConfig({DEMO_ENTRY_SNAPSHOT_ENABLED:'true',DEMO_SNAPSHOT_TOKEN:'x'.repeat(64)},'demo')).toThrow();
    const env={DEMO_ENTRY_SNAPSHOT_ENABLED:'true',DEMO_SNAPSHOT_TOKEN:'aB1-cD2-eF3-gH4-iJ5-kL6-mN7-oP8-qR9'};
    expect(()=>snapshotConfig({...env,DEMO_SNAPSHOT_SOURCE_URL:'http://source/internal/demo-snapshot'},'demo')).toThrow();
    expect(()=>snapshotConfig(env,'production')).toThrow('separate');
  });
  it('uses one read-only repeatable-read transaction and always releases it', async () => {
    const query=vi.fn(async sql=>[sql.includes('FROM recruiter_tracker')?raw().contacts:sql.includes('FROM weekly_reports')?raw().reports:sql.includes('FROM report_job_contacts')?raw().links:[]]);
    const connection={query,rollback:vi.fn(),release:vi.fn(),destroy:vi.fn()};
    const result=await captureSnapshot({getConnection:async()=>connection});
    expect(query.mock.calls[0][0]).toContain('REPEATABLE READ');
    expect(query.mock.calls[1][0]).toContain('CONSISTENT SNAPSHOT, READ ONLY');
    expect(query.mock.calls.slice(2).some(([sql])=>/SELECT \*/.test(sql))).toBe(false);
    expect(result.contacts).toHaveLength(1);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
  it('rolls back and releases after a query failure', async () => {
    const connection={query:vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockRejectedValue(new Error('DB fail')),
      rollback:vi.fn(),release:vi.fn(),destroy:vi.fn()};
    await expect(captureSnapshot({getConnection:async()=>connection})).rejects.toThrow('DB fail');
    expect(connection.rollback).toHaveBeenCalledOnce();expect(connection.release).toHaveBeenCalledOnce();
  });
  it('refuses unauthenticated source requests without querying PROD', async () => {
    const capture=vi.fn(),res=response();
    await createSnapshotSource({pool:{},token:'secret',capture})({headers:{}},res);
    expect(res.code).toBe(401);expect(capture).not.toHaveBeenCalled();
  });
  it('returns generic capture failure, never source credentials or private errors', async () => {
    const res=response();
    await createSnapshotSource({pool:{},token:'secret',capture:async()=>{throw new Error('PRIVATE');}})({headers:{authorization:'Bearer secret'}},res);
    expect(res.code).toBe(503);expect(JSON.stringify(res.data)).not.toContain('PRIVATE');
  });
  it('requires exact table-only SELECT grants on a separate source identity', async () => {
    for(const extra of ['', 'GRANT ALL PRIVILEGES ON *.* TO `reader`@`%`']) {
      const grants=['recruiter_tracker','weekly_reports','report_job_contacts'].map(table=>({g:'GRANT SELECT ON `railway`.`'+table+'` TO `reader`@`%`'}));
      if(extra)grants.push({g:extra});
      const connection={query:vi.fn().mockResolvedValueOnce([[{db:'railway'}]]).mockResolvedValueOnce([grants]).mockResolvedValueOnce([[{ENGINE:'InnoDB'},{ENGINE:'InnoDB'},{ENGINE:'InnoDB'}]]),release:vi.fn()};
      const pool={getConnection:async()=>connection,end:vi.fn()};
      const task=createReadOnlySnapshotPool({createPool:()=>pool},{},{user:'reader',password:'private'});
      if(extra)await expect(task).rejects.toThrow('allowlist');else expect(await task).toBe(pool);
      expect(connection.release).toHaveBeenCalledOnce();
    }
  });
  it('refuses nontransactional source tables even with correct SELECT grants', async () => {
    const grants=['recruiter_tracker','weekly_reports','report_job_contacts'].map(table=>({g:'GRANT SELECT ON `railway`.`'+table+'` TO `reader`@`%`'}));
    const connection={query:vi.fn().mockResolvedValueOnce([[{db:'railway'}]]).mockResolvedValueOnce([grants])
      .mockResolvedValueOnce([[{ENGINE:'InnoDB'},{ENGINE:'MyISAM'},{ENGINE:'InnoDB'}]]),release:vi.fn()};
    const pool={getConnection:async()=>connection,end:vi.fn()};
    await expect(createReadOnlySnapshotPool({createPool:()=>pool},{},{user:'reader',password:'private'})).rejects.toThrow('InnoDB');
    expect(pool.end).toHaveBeenCalledOnce();expect(connection.release).toHaveBeenCalledOnce();
  });
  it('bounds the fetched body and rejects redirects and failed source responses', async () => {
    const request=vi.fn(async()=>new Response(JSON.stringify(raw())));
    expect((await fetchSnapshot({url:'https://source',token:'private'},request)).contacts).toHaveLength(1);
    expect(request.mock.calls[0][1].redirect).toBe('error');
    await expect(fetchSnapshot({},async()=>new Response('',{status:503}))).rejects.toThrow('unavailable');
    await expect(fetchSnapshot({},async()=>new Response('x'.repeat(8*1024*1024+1)))).rejects.toThrow('limit');
  });
});

describe('session ownership, expiry and atomic publication', () => {
  it('keeps A frozen after LIVE changes; a new B gets current data; reload reuses A', async () => {
    let value=raw();const load=vi.fn(async()=>protectSnapshot(value));
    const store=createGuestSnapshots({load});
    const a=await store.enter('server-issued-A');
    value=raw();value.contacts[0].company='Changed employer';
    const b=await store.enter('server-issued-B');
    expect(store.get('server-issued-A')).toEqual(a);
    expect((await store.enter('server-issued-A')).contacts[0].company).toBe('Example employer');
    expect(b.contacts[0].company).toBe('Changed employer');
    expect(store.get('invented-other-session')).toBeUndefined();expect(load).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent entry and publishes nothing on failure', async () => {
    let resolve;const load=vi.fn(()=>new Promise(r=>{resolve=r;}));
    const store=createGuestSnapshots({load});const a=store.enter('A');const b=store.enter('A');
    expect(store.get('A')).toBeUndefined();resolve(raw());
    expect(await a).toEqual(await b);expect(load).toHaveBeenCalledOnce();
    const broken=createGuestSnapshots({load:async()=>{throw new Error('fail');}});
    await expect(broken.enter('A')).rejects.toThrow();expect(broken.get('A')).toBeUndefined();
  });
  it('expires without silently refreshing and frees capacity on logout', async () => {
    let clock=0;const load=vi.fn(async()=>raw());
    const store=createGuestSnapshots({load,now:()=>clock,ttl:100,maxSessions:1});
    await store.enter('A');await expect(store.enter('B')).rejects.toThrow('capacity');
    clock=101;expect(store.get('A')).toBeUndefined();expect(load).toHaveBeenCalledOnce();
    await store.enter('B');store.drop('B');expect(store.get('B')).toBeUndefined();
    await store.enter('C');
  });
  it('refuses oversize storage rather than evicting another active guest', async () => {
    const store=createGuestSnapshots({load:async()=>raw(),maxBytes:1});
    await expect(store.enter('A')).rejects.toThrow('capacity');expect(store.get('A')).toBeUndefined();
  });
  it('serves consistent contacts, report links, timestamp and safe exports; unknown business reads fail closed', () => {
    const snapshot=protectSnapshot(raw());const session={demoSnapshotExpiresAt:'later'};
    const request=path=>{const res=response();const next=vi.fn();snapshotBusinessRead({method:'GET',path,demoSnapshot:snapshot,session},res,next);return {res,next};};
    expect(request('/api/contacts').res.data).toEqual(snapshot.contacts);
    expect(request('/api/reports/2').res.data.employers[0].company).toBe('Example employer');
    expect(request('/api/reports/999').res.code).toBe(404);
    expect(request('/api/reports/unemployment/export').res.code).toBe(403);
    expect(request('/api/demo-refresh/latest').res.data.snapshot.capturedAt).toBe(snapshot.capturedAt);
    snapshot.contacts[0].company='=HYPERLINK("private")';
    expect(request('/api/contacts/export').res.data).toContain("'=HYPERLINK");
    expect(request('/api/contacts/export').res.data).not.toContain('PRIVATE');
    expect(request('/api/contacts/99').next).not.toHaveBeenCalled();
  });
});

describe('snapshot lifecycle acceptance', () => {
  it('does not publish a capture after its session has been dropped', async () => {
    let finish, calls=0;
    const store=createGuestSnapshots({load:()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve(raw()),maxSessions:1});
    const capture=store.enter('A');
    store.drop('A');
    await expect(store.enter('B')).rejects.toThrow('capacity');
    finish(raw());
    await expect(capture).rejects.toThrow();
    expect(store.get('A')).toBeUndefined();
    await expect(store.enter('B')).resolves.toBeDefined();
  });
});
