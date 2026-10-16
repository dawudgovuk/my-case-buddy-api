/**
 * clean-db.js
 *
 * Resets the entire database to a clean, fresh, production-ready release state.
 *
 * What it clears:
 * 1. All Family Court domain records:
 *    - cases, parties, hearings, orders, documents, case_notes, document_deadlines, case_invites
 *    - all relational join/link tables (*_lnk)
 * 2. All User & Authentication records:
 *    - Neon Managed Better Auth (neon_auth: user, account, session, verification, invitation, member)
 *    - Strapi Users-Permissions (public: up_users, up_users_role_lnk, strapi_sessions)
 * 3. Resets all database auto-increment identity sequences to 1.
 *
 * What it safely preserves:
 * - Strapi schemas, migrations, and core configuration
 * - Strapi Admin roles & permissions
 * - up_roles (Authenticated, Public) and up_permissions (so new users immediately work)
 * - Neon Auth system config and JWKS signing keys
 *
 * Usage:
 *   node scripts/clean-db.js
 *   npm run db:clean
 *   npm run db:fresh
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

const keepUsers = process.argv.includes('--keep-users');

async function cleanDatabase() {
  console.log('🚀 Resetting Database to Fresh Production State...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL (Neon).');

    // 1. Neon Auth (Better Auth) cleanup
    if (!keepUsers) {
      const checkNeonAuth = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'neon_auth';
      `);

      if (checkNeonAuth.rows.length > 0) {
        const neonAuthTables = ['session', 'account', 'verification', 'invitation', 'member', 'user'];
        const existingNeonTables = checkNeonAuth.rows
          .map((r) => r.table_name)
          .filter((t) => neonAuthTables.includes(t));

        if (existingNeonTables.length > 0) {
          const sql = `TRUNCATE TABLE ${existingNeonTables.map((t) => `neon_auth."${t}"`).join(', ')} CASCADE;`;
          await client.query(sql);
          console.log('   ✓ Neon Auth tables cleared: ' + existingNeonTables.join(', '));
        }
      }
    }

    // 2. Strapi Application and User Tables
    const applicationTables = [
      'case_invites_used_by_lnk',
      'case_invites_case_lnk',
      'case_invites',
      'document_deadlines_assigned_to_lnk',
      'document_deadlines_case_lnk',
      'document_deadlines',
      'case_notes_case_lnk',
      'case_notes',
      'documents_case_lnk',
      'documents',
      'orders_case_lnk',
      'orders',
      'hearings_case_lnk',
      'hearings',
      'parties_case_lnk',
      'parties',
      'cases_members_lnk',
      'cases_owner_lnk',
      'cases',
    ];

    if (!keepUsers) {
      applicationTables.push('up_users_role_lnk', 'up_users', 'strapi_sessions');
    }

    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1::text[])
    `;
    const existingResult = await client.query(checkQuery, [applicationTables]);
    const existingTables = existingResult.rows.map((r) => r.table_name);

    if (existingTables.length > 0) {
      console.log(`🗑️  Truncating ${existingTables.length} application tables with RESTART IDENTITY CASCADE...`);
      const truncateSql = `TRUNCATE TABLE ${existingTables.join(', ')} RESTART IDENTITY CASCADE;`;
      await client.query(truncateSql);

      // Reset auto-increment sequences
      for (const table of existingTables) {
        try {
          const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') as seq_name;`, [table]);
          const seqName = seqRes.rows[0]?.seq_name;
          if (seqName) {
            await client.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1;`);
          }
        } catch {
          // Ignore tables without serial id
        }
      }
      console.log('   ✓ Application tables truncated and sequences reset to 1.');
    }

    // 3. Verification check
    const neonUserCountRes = await client.query(`SELECT count(*) FROM neon_auth."user";`).catch(() => ({ rows: [{ count: 0 }] }));
    const upUserCountRes = await client.query(`SELECT count(*) FROM up_users;`).catch(() => ({ rows: [{ count: 0 }] }));
    const caseCountRes = await client.query(`SELECT count(*) FROM cases;`).catch(() => ({ rows: [{ count: 0 }] }));

    console.log('\n============================================================');
    console.log('✨ Database Successfully Reset to Production Release State!');
    console.log('============================================================');
    console.log(`   Neon Auth Users:   ${neonUserCountRes.rows[0].count}`);
    console.log(`   Strapi Users:      ${upUserCountRes.rows[0].count}`);
    console.log(`   Family Cases:      ${caseCountRes.rows[0].count}`);
    console.log('------------------------------------------------------------');
    console.log('🎉 The database is completely fresh, clean, and ready for new users to register!\n');
  } catch (err) {
    console.error('❌ Database cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

cleanDatabase();
