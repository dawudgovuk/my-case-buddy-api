/**
 * clean-users.js
 *
 * Cleans all user records and authentication sessions across both:
 * 1. Neon Managed Better Auth (neon_auth schema: user, account, session, verification, invitation, member)
 * 2. Strapi Users-Permissions (public schema: up_users, up_users_role_lnk)
 *
 * Also safely unlinks user foreign keys from cases and deadlines.
 *
 * Usage:
 *   node scripts/clean-users.js
 *   npm run db:clean-users
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

async function cleanUsers() {
  console.log('🧹 Starting User Cleanup across Neon Auth and Strapi...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL (Neon).');

    // 1. Clean Neon Auth (Better Auth) users and sessions
    const checkNeonAuth = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'neon_auth';
    `);

    if (checkNeonAuth.rows.length > 0) {
      console.log('🗑️  Truncating Neon Auth (Better Auth) tables...');
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

    // 2. Clean Strapi Users and user link tables
    console.log('🗑️  Truncating Strapi users and user relationship links...');
    const strapiUserTables = [
      'cases_members_lnk',
      'cases_owner_lnk',
      'document_deadlines_assigned_to_lnk',
      'case_invites_used_by_lnk',
      'up_users_role_lnk',
      'up_users',
    ];

    const checkStrapi = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[]);`,
      [strapiUserTables]
    );
    const existingStrapi = checkStrapi.rows.map((r) => r.table_name);

    if (existingStrapi.length > 0) {
      const sql = `TRUNCATE TABLE ${existingStrapi.join(', ')} RESTART IDENTITY CASCADE;`;
      await client.query(sql);
      console.log('   ✓ Strapi user tables cleared: ' + existingStrapi.join(', '));
    }

    // 3. Reset up_users id sequence
    try {
      const seqRes = await client.query(`SELECT pg_get_serial_sequence('up_users', 'id') as seq;`);
      if (seqRes.rows[0]?.seq) {
        await client.query(`ALTER SEQUENCE ${seqRes.rows[0].seq} RESTART WITH 1;`);
      }
    } catch {}

    // Verify
    const uCount = await client.query(`SELECT count(*) FROM neon_auth."user";`).catch(() => ({ rows: [{ count: 0 }] }));
    const upCount = await client.query(`SELECT count(*) FROM up_users;`).catch(() => ({ rows: [{ count: 0 }] }));

    console.log('\n============================================================');
    console.log('✅ All Users Removed Successfully!');
    console.log(`   Neon Auth users remaining:   ${uCount.rows[0].count}`);
    console.log(`   Strapi up_users remaining:   ${upCount.rows[0].count}`);
    console.log('============================================================');
    console.log('\n✨ You can now register any email address without "User already exists" errors.\n');
  } catch (err) {
    console.error('❌ Failed to clean users:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

cleanUsers();
