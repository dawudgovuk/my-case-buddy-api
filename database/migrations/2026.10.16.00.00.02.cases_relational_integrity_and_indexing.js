/**
 * Migration: 2026.10.16.00.00.02.cases_relational_integrity_and_indexing.js
 * Description: Ensures relational case link tables, indexes, and owner data integrity.
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
   * Apply migration
   */
  async up(ctx) {
    // 1. Ensure cases_owner_lnk exists and is indexed
    await executeSql(ctx, `
      CREATE TABLE IF NOT EXISTS cases_owner_lnk (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cases_owner_lnk_case_id ON cases_owner_lnk (case_id);
      CREATE INDEX IF NOT EXISTS idx_cases_owner_lnk_user_id ON cases_owner_lnk (user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_owner_lnk_unique ON cases_owner_lnk (case_id, user_id);
    `);

    // 2. Ensure cases_members_lnk exists and is indexed
    await executeSql(ctx, `
      CREATE TABLE IF NOT EXISTS cases_members_lnk (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cases_members_lnk_case_id ON cases_members_lnk (case_id);
      CREATE INDEX IF NOT EXISTS idx_cases_members_lnk_user_id ON cases_members_lnk (user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_members_lnk_unique ON cases_members_lnk (case_id, user_id);
    `);

    // 3. Performance indexes on cases table
    await executeSql(ctx, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
          CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases (case_number);
          CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);
          CREATE INDEX IF NOT EXISTS idx_cases_seeking_peer_support ON cases (seeking_peer_support);
        END IF;
      END $$;
    `);

    // 4. Data Integrity: Backfill any orphaned cases to ensure owner link exists
    await executeSql(ctx, `
      DO $$
      DECLARE
        c_record RECORD;
        first_user_id INT;
      BEGIN
        -- Find default LIP user id if needed
        SELECT id INTO first_user_id FROM up_users WHERE user_role = 'LIP' ORDER BY id ASC LIMIT 1;
        IF first_user_id IS NULL THEN
          SELECT id INTO first_user_id FROM up_users ORDER BY id ASC LIMIT 1;
        END IF;

        IF first_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
          FOR c_record IN 
            SELECT c.id FROM cases c
            LEFT JOIN cases_owner_lnk col ON col.case_id = c.id
            WHERE col.id IS NULL
          LOOP
            INSERT INTO cases_owner_lnk (case_id, user_id)
            VALUES (c_record.id, first_user_id)
            ON CONFLICT DO NOTHING;
          END LOOP;
        END IF;
      END $$;
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DROP INDEX IF EXISTS idx_cases_seeking_peer_support;
      DROP INDEX IF EXISTS idx_cases_status;
      DROP INDEX IF EXISTS idx_cases_case_number;
      DROP INDEX IF EXISTS idx_cases_members_lnk_unique;
      DROP INDEX IF EXISTS idx_cases_members_lnk_user_id;
      DROP INDEX IF EXISTS idx_cases_members_lnk_case_id;
      DROP INDEX IF EXISTS idx_cases_owner_lnk_unique;
      DROP INDEX IF EXISTS idx_cases_owner_lnk_user_id;
      DROP INDEX IF EXISTS idx_cases_owner_lnk_case_id;
    `);
  },
};

