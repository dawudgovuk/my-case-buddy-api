/**
 * Migration: 2026.10.22.00.00.01.create_case_presets_schema.js
 * Description: Scaffolds the case_presets table for pre-populating standard court jurisdiction
 *              and proceedings track with one click. Grants permissions to Public and Authenticated roles,
 *              and seeds initial standard UK Family Court quick presets.
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
    // 1. Create case_presets table
    await executeSql(ctx, `
      CREATE TABLE IF NOT EXISTS case_presets (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        preset_key VARCHAR(255) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        title_template VARCHAR(255) NOT NULL,
        case_type VARCHAR(255) NOT NULL,
        court VARCHAR(255) DEFAULT 'Family Court',
        icon VARCHAR(255) DEFAULT 'child',
        description TEXT,
        "order" INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_case_presets_key ON case_presets (preset_key);
      CREATE INDEX IF NOT EXISTS idx_case_presets_docid ON case_presets (document_id);
      CREATE INDEX IF NOT EXISTS idx_case_presets_order ON case_presets ("order");
      CREATE INDEX IF NOT EXISTS idx_case_presets_active ON case_presets (is_active);
    `);

    // 2. Grant find & findOne permissions to Public & Authenticated roles
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::case-preset.case-preset.find',
          'api::case-preset.case-preset.findOne'
        ];
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        FOREACH act IN ARRAY actions
        LOOP
          SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
          IF perm_id IS NULL THEN
            INSERT INTO up_permissions (action, created_at, updated_at)
            VALUES (act, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id INTO perm_id;
          END IF;

          -- Grant to Public role
          IF pub_role_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM up_permissions_role_lnk 
            WHERE permission_id = perm_id AND role_id = pub_role_id
          ) THEN
            INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
            VALUES (perm_id, pub_role_id, 1);
          END IF;

          -- Grant to Authenticated role
          IF auth_role_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM up_permissions_role_lnk 
            WHERE permission_id = perm_id AND role_id = auth_role_id
          ) THEN
            INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
            VALUES (perm_id, auth_role_id, 1);
          END IF;
        END LOOP;
      END $$;
    `);

    // 3. Seed initial 5 standard case presets
    await executeSql(ctx, `
      INSERT INTO case_presets (
        document_id,
        preset_key,
        label,
        title_template,
        case_type,
        court,
        icon,
        description,
        "order",
        is_active
      )
      VALUES 
        (
          'preset_ca_01',
          'child-arrangements',
          'Child Arrangements',
          'Application for Child Arrangements (Live With / Contact)',
          'Private Law (Child Arrangements)',
          'Family Court',
          'child',
          'Residence, spend time with & holiday contact',
          1,
          TRUE
        ),
        (
          'preset_pso_02',
          'prohibited-steps',
          'Prohibited Steps Order',
          'Application for Prohibited Steps / Specific Issue Order',
          'Private Law (Child Arrangements)',
          'Family Court',
          'shield',
          'Schooling, relocation, or medical decisions',
          2,
          TRUE
        ),
        (
          'preset_nonmol_03',
          'non-molestation',
          'Non-Molestation',
          'Application for Non-Molestation & Occupation Order',
          'Domestic Abuse (Non-Molestation)',
          'Family Court',
          'shield',
          'Protection from domestic abuse and harassment',
          3,
          TRUE
        ),
        (
          'preset_fin_04',
          'financial-remedy',
          'Financial Remedies',
          'Financial Remedy Proceedings (Form A / Consent)',
          'Financial Remedies',
          'Family Court',
          'balance',
          'Maintenance, property adjustment & pensions',
          4,
          TRUE
        ),
        (
          'preset_care_05',
          'care-proceedings',
          'Care / Supervision',
          'Public Law Proceedings under Section 31 Children Act',
          'Public Law (Care Proceedings)',
          'Family Court',
          'file',
          'Local authority care or supervision orders',
          5,
          TRUE
        )
      ON CONFLICT (preset_key) DO UPDATE 
      SET 
        label = EXCLUDED.label,
        title_template = EXCLUDED.title_template,
        case_type = EXCLUDED.case_type,
        court = EXCLUDED.court,
        icon = EXCLUDED.icon,
        description = EXCLUDED.description,
        "order" = EXCLUDED."order",
        is_active = EXCLUDED.is_active;
    `);
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    // 1. Remove permissions
    await executeSql(ctx, `
      DO $$
      DECLARE
        perm_id INT;
        act TEXT;
        actions TEXT[] := ARRAY[
          'api::case-preset.case-preset.find',
          'api::case-preset.case-preset.findOne'
        ];
      BEGIN
        FOREACH act IN ARRAY actions
        LOOP
          SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
          IF perm_id IS NOT NULL THEN
            DELETE FROM up_permissions_role_lnk WHERE permission_id = perm_id;
            DELETE FROM up_permissions WHERE id = perm_id;
          END IF;
        END LOOP;
      END $$;
    `);

    // 2. Drop table
    await executeSql(ctx, `
      DROP TABLE IF EXISTS case_presets CASCADE;
    `);
  }
};
