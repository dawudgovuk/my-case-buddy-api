/**
 * migrate.js
 * 
 * Production-grade migration engine for Lakebase Postgres on Neon & Strapi v5.
 * Strictly adheres to Neon database migration guidelines:
 * - Uses direct (unpooled) connections for transactional DDL operations.
 * - Tracks applied migrations in an ACID-compliant `_schema_migrations` audit table.
 * - Supports CLI operations: up (migrate), down (rollback), status, and create.
 * - Compatible with Strapi Knex runner or standalone executions.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 1. Resolve Environment Variables from .env or .env.local
function loadEnv() {
  const envCandidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '.env.local'),
    path.resolve(__dirname, '..', '..', 'my-case-buddy-cms', '.env.local'),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

// Prefer unpooled direct connection for DDL migrations per Neon best practices
const rawConnectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.VITE_NEON_DATABASE_URL;

// Ensure direct connection does not inadvertently use -pooler
function getDirectConnectionString(connStr) {
  if (!connStr) return null;
  // If connection string contains -pooler, strip it to get the direct endpoint
  return connStr.replace('-pooler.', '.');
}

const directConnectionString = getDirectConnectionString(rawConnectionString);

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'database', 'migrations');

async function getClient() {
  if (!directConnectionString) {
    console.error('❌ Error: DATABASE_URL or DATABASE_URL_UNPOOLED is not set.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: directConnectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// 2. Ensure migration tracking table exists
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      batch INTEGER NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_ms INTEGER NOT NULL
    );
  `);
}

// 3. Helper to wrap pg.Client to support both raw SQL and knex-like signatures
function createMigrationContext(client) {
  return {
    client,
    query: (text, params) => client.query(text, params),
    raw: (text, params) => client.query(text, params),
  };
}

// 4. List all migration files
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('.'))
    .sort();
}

// 5. Command: Status
async function status() {
  console.log('🔍 Checking Schema Migration Status on Neon PostgreSQL...\n');
  const client = await getClient();
  try {
    await ensureMigrationsTable(client);
    const res = await client.query('SELECT name, batch, applied_at, duration_ms FROM _schema_migrations ORDER BY id ASC');
    const appliedMap = new Map(res.rows.map((r) => [r.name, r]));
    const files = getMigrationFiles();

    console.log('┌─────────────────────────────────────────────────────────────┬───────────┬──────────────────────┬─────────────┐');
    console.log('│ Migration File Name                                         │ Status    │ Applied At           │ Batch #     │');
    console.log('├─────────────────────────────────────────────────────────────┼───────────┼──────────────────────┼─────────────┤');

    if (files.length === 0) {
      console.log('│ No migration files found in database/migrations/           │           │                      │             │');
    }

    for (const file of files) {
      const record = appliedMap.get(file);
      const paddedName = file.padEnd(59).slice(0, 59);
      if (record) {
        const dateStr = new Date(record.applied_at).toISOString().slice(0, 19).replace('T', ' ');
        console.log(`│ \x1b[32m${paddedName}\x1b[0m │ \x1b[32mAPPLIED  \x1b[0m │ ${dateStr.padEnd(20)} │ Batch #${String(record.batch).padEnd(4)} │`);
      } else {
        console.log(`│ \x1b[33m${paddedName}\x1b[0m │ \x1b[33mPENDING  \x1b[0m │                      │             │`);
      }
    }
    console.log('└─────────────────────────────────────────────────────────────┴───────────┴──────────────────────┴─────────────┘\n');

    const pendingCount = files.filter((f) => !appliedMap.has(f)).length;
    console.log(`Summary: ${files.length} total, ${res.rows.length} applied, ${pendingCount} pending.`);
  } finally {
    await client.end();
  }
}

// 6. Command: Up (Apply pending)
async function up() {
  console.log('🚀 Executing Pending Schema Migrations on Neon PostgreSQL...\n');
  const client = await getClient();
  try {
    await ensureMigrationsTable(client);
    const appliedRes = await client.query('SELECT name FROM _schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r) => r.name));

    const batchRes = await client.query('SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM _schema_migrations');
    const nextBatch = Number(batchRes.rows[0].next_batch);

    const files = getMigrationFiles();
    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✨ All migrations are up to date! Nothing to execute.');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s) for Batch #${nextBatch}.\n`);

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const migrationModule = require(filePath);
      const ctx = createMigrationContext(client);

      const startTime = Date.now();
      console.log(`  Applying: \x1b[36m${file}\x1b[0m...`);

      await client.query('BEGIN');
      try {
        if (typeof migrationModule.up === 'function') {
          await migrationModule.up(ctx);
        } else {
          throw new Error(`Migration ${file} does not export an 'up' function.`);
        }

        const duration = Date.now() - startTime;
        await client.query(
          'INSERT INTO _schema_migrations (name, batch, duration_ms) VALUES ($1, $2, $3)',
          [file, nextBatch, duration]
        );
        await client.query(`
          INSERT INTO strapi_migrations (name, time)
          SELECT $1, CURRENT_TIMESTAMP
          WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strapi_migrations')
          AND NOT EXISTS (SELECT 1 FROM strapi_migrations WHERE name = $1);
        `, [file]);
        await client.query('COMMIT');
        console.log(`  ✔ \x1b[32mSuccessfully applied ${file}\x1b[0m (${duration}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Migration failed on ${file}:`);
        console.error(err.message);
        process.exit(1);
      }
    }

    console.log(`\n🎉 All ${pending.length} migration(s) completed successfully!`);
  } finally {
    await client.end();
  }
}

// 7. Command: Down (Rollback latest batch)
async function down() {
  console.log('⏪ Rolling back latest migration batch on Neon PostgreSQL...\n');
  const client = await getClient();
  try {
    await ensureMigrationsTable(client);
    const batchRes = await client.query('SELECT MAX(batch) as latest_batch FROM _schema_migrations');
    const latestBatch = batchRes.rows[0].latest_batch;

    if (!latestBatch) {
      console.log('ℹ️ No applied migrations found to rollback.');
      return;
    }

    const res = await client.query(
      'SELECT name FROM _schema_migrations WHERE batch = $1 ORDER BY id DESC',
      [latestBatch]
    );
    const toRollback = res.rows.map((r) => r.name);

    console.log(`Reverting Batch #${latestBatch} (${toRollback.length} migration(s)):`);

    for (const file of toRollback) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️ Migration file ${file} no longer exists on disk; removing tracking record.`);
        await client.query('DELETE FROM _schema_migrations WHERE name = $1', [file]);
        continue;
      }

      const migrationModule = require(filePath);
      const ctx = createMigrationContext(client);

      console.log(`  Reverting: \x1b[33m${file}\x1b[0m...`);
      await client.query('BEGIN');
      try {
        if (typeof migrationModule.down === 'function') {
          await migrationModule.down(ctx);
        }
        await client.query('DELETE FROM _schema_migrations WHERE name = $1', [file]);
        await client.query(`
          DELETE FROM strapi_migrations WHERE name = $1
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strapi_migrations');
        `, [file]);
        await client.query('COMMIT');
        console.log(`  ✔ \x1b[32mSuccessfully rolled back ${file}\x1b[0m`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Rollback failed on ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log(`\n🎉 Batch #${latestBatch} rollback complete.`);
  } finally {
    await client.end();
  }
}

// 8. Command: Create new migration
function createMigration(name) {
  if (!name) {
    console.error('❌ Error: Migration name is required. Usage: npm run db:migrate:create <name>');
    process.exit(1);
  }

  const sanitized = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  const fileName = `${timestamp}.${sanitized}.js`;
  const filePath = path.join(MIGRATIONS_DIR, fileName);

  const boilerplate = `/**
 * Migration: ${fileName}
 * Created: ${now.toISOString()}
 */

async function executeSql(ctx, sql) {
  if (typeof ctx.raw === 'function') {
    return ctx.raw(sql);
  }
  if (typeof ctx.query === 'function') {
    return ctx.query(sql);
  }
  throw new Error('Unsupported migration context: neither ctx.raw nor ctx.query is available');
}

module.exports = {
  /**
   * Apply database changes (ACID Transactional DDL)
   * Compatible with both Strapi v5 Knex runner and standalone CLI pg.Client runner.
   * @param {Object} ctx - Migration context containing .raw(sql) and .query(sql)
   */
  async up(ctx) {
    // Example:
    // await executeSql(ctx, \`
    //   CREATE INDEX IF NOT EXISTS idx_custom_column ON cases (custom_column);
    // \`);
  },

  /**
   * Revert database changes
   * @param {Object} ctx - Migration context containing .raw(sql) and .query(sql)
   */
  async down(ctx) {
    // Example:
    // await executeSql(ctx, \`
    //   DROP INDEX IF EXISTS idx_custom_column;
    // \`);
  },
};
`;

  fs.writeFileSync(filePath, boilerplate, 'utf8');
  console.log(`\n✅ Created migration file: \x1b[32mdatabase/migrations/${fileName}\x1b[0m`);
  console.log('   Add your SQL statements in the up() and down() methods.');
}

// 9. CLI dispatcher
const action = (process.argv[2] || 'up').toLowerCase();

switch (action) {
  case 'up':
  case 'migrate':
    up().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case 'down':
  case 'rollback':
    down().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case 'status':
    status().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  case 'create':
    createMigration(process.argv[3]);
    break;
  default:
    console.log(`Unknown command "${action}". Available: up, down, status, create <name>`);
    process.exit(1);
}
