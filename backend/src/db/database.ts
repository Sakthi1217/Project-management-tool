import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Force pg to return DATE columns as plain 'YYYY-MM-DD' strings
// instead of JavaScript Date objects (which add T00:00:00.000Z)
pg.types.setTypeParser(1082, (val: string) => val); // DATE → string
pg.types.setTypeParser(1114, (val: string) => val); // TIMESTAMP WITHOUT TZ → string
pg.types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ → string

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate all required DB env vars at startup
const requiredDbVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
for (const v of requiredDbVars) {
  if (!process.env[v]) {
    console.error(`FATAL: ${v} environment variable is not set. Exiting.`);
    process.exit(1);
  }
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export async function initializeDatabase(): Promise<void> {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('✅ Database schema initialized');
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function getOne(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

export async function getAll(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function run(text: string, params?: any[]) {
  return pool.query(text, params);
}

export default pool;
