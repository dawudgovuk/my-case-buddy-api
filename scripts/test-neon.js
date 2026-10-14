const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const connectionString = process.env.DATABASE_URL;

async function testConnection() {
  console.log('🧪 Testing Strapi Neon PostgreSQL Connection...\n');
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as now, version() as version, current_database() as db;');
    const row = res.rows[0];
    console.log('✅ PostgreSQL Connected Successfully!');
    console.log(`   Database: ${row.db}`);
    console.log(`   Timestamp: ${row.now}`);
    console.log(`   Engine: ${row.version.split(' ')[0]} ${row.version.split(' ')[1]}`);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

testConnection();
