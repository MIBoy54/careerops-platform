import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { hiddenInput, localDevConfig, runCli, validatePassword, verifyApplication } from './dev-bootstrap.js';

export async function createDevUser(env, { email, password, confirmation }, connect = mysql.createConnection, stage = () => {}) {
  stage('configuration');
  const config = localDevConfig(env);
  // Reserved synthetic domain only. Never bootstrap a real owner's identity.
  if (typeof email !== 'string' || !/^[a-z0-9][a-z0-9._+-]{0,63}@example\.invalid$/i.test(email.trim())) {
    throw new Error('Use a synthetic email at example.invalid.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  validatePassword(password);
  if (password !== confirmation || password === env.DB_PASSWORD) throw new Error('Passwords must match and differ from the database password.');
  stage('connection');
  const connection = await connect({ ...config.primary, multipleStatements: false });
  try {
    stage('account verification');
    await verifyApplication(connection, env, config);
    stage('user creation');
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) throw new Error('DEV login already exists; refusing overwrite.');
    const hash = await bcrypt.hash(password, 12);
    try {
      await connection.execute('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [normalizedEmail, hash, 'Local DEV Admin', 'admin']);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new Error('DEV login already exists; refusing overwrite.');
      throw new Error('DEV login creation failed.');
    }
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli(async (env, stage) => {
    localDevConfig(env);
    const email = await hiddenInput('Synthetic DEV email at example.invalid');
    const password = await hiddenInput('New DEV login password');
    const confirmation = await hiddenInput('Confirm DEV login password');
    await createDevUser(env, { email, password, confirmation }, mysql.createConnection, stage);
    console.log('Synthetic local DEV administrator created.');
  });
}
