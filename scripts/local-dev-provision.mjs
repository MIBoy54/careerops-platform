import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { bootstrapDev, verifyApplication, localDevConfig } from './dev-bootstrap.js';
import { createDevUser } from './dev-create-user.js';
const secrets = JSON.parse(fs.readFileSync('/run/careerops/provision.json', 'utf8'));
const root = await mysql.createConnection({host:'127.0.0.1', user:'root', password:secrets.root});
let uuid;
try { [[{ uuid }]] = await root.query('SELECT @@server_uuid AS uuid'); }
finally { await root.end(); }
const env = { ...process.env, DEV_INSTANCE_ID:uuid, DEV_DB_ACCOUNT_HOST:'127.0.0.1' };
await bootstrapDev({...env, DEV_PROVISION_USER:'root', DEV_PROVISION_PASSWORD:secrets.root,
  DEV_BOOTSTRAP_CONFIRM:`careerops_dev@${uuid}`});
await createDevUser(env, {email:secrets.email,password:secrets.login,confirmation:secrets.login});
const app = await mysql.createConnection(localDevConfig(env).primary);
try {
  await verifyApplication(app,env,localDevConfig(env));
  await app.query('CREATE TABLE forbidden_test (id INT)').then(() => { throw new Error('Unexpected DDL grant'); }, e => {
    if (!['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes(e.code)) throw e;
  });
} finally { await app.end(); }
console.log(JSON.stringify({result:'PASS',bootstrapAttempts:1,instanceUuid:uuid,
  email:secrets.email,schema:'careerops_dev',ddlDenied:true}));
