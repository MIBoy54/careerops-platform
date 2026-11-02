import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { SNAPSHOT_LINKS_SQL } from '../../src/demoSnapshot.js';

// Only the named disposable SQL fixture is accessed. CTEs supply all records;
// no application table is read, created, repaired or deleted.
const suite = process.env.SNAPSHOT_TEST_MYSQL === '1' ? describe : describe.skip;
function project(contactIds, reportIds, links) {
  const ids = values => values.length ? values.map(id => 'SELECT '+Number(id)+' AS id').join(' UNION ALL ')
    : 'SELECT NULL AS id WHERE FALSE';
  const rows = links.length ? links.map(([report,contact]) =>
    'SELECT '+(report===null?'NULL':Number(report))+' AS report_id, '+
    (contact===null?'NULL':Number(contact))+' AS recruiter_tracker_id').join(' UNION ALL ')
    : 'SELECT NULL AS report_id, NULL AS recruiter_tracker_id WHERE FALSE';
  const sql = 'START TRANSACTION READ ONLY; WITH recruiter_tracker AS ('+ids(contactIds)+
    '), weekly_reports AS ('+ids(reportIds)+'), report_job_contacts AS ('+rows+') '+
    SNAPSHOT_LINKS_SQL+'; ROLLBACK;';
  const env = {...process.env};
  for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
  const output=execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',
    'careerops-trend-dev-test','mysql','-uroot','--batch','--raw','--skip-column-names'],
    {input:sql,encoding:'utf8',env});
  return output.trim()?output.trim().split('\n').map(line=>line.split('\t').map(Number)):[];
}
suite('MySQL snapshot relationship projection using synthetic CTEs',()=>{
  it('excludes missing contacts, missing reports, both missing and null references',()=>{
    expect(project([1],[10],[[10,1],[10,999],[999,1],[999,999],[null,1],[10,null]])).toEqual([[10,1]]);
  });
  it('retains every valid relationship across multiple contacts and reports',()=>{
    expect(project([1,2],[10,20],[[10,1],[10,2],[20,2],[999,2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]))
      .toEqual([[10,1],[10,2],[20,2]]);
  });
  it('returns no relationships when no endpoints survive',()=>{
    expect(project([],[],[[10,1],[20,2]])).toEqual([]);
  });
});
