/**
 * Migration: 2026.10.21.00.00.02.create_dynamic_case_metadata_schemas.js
 * Description: Scaffolds dynamic Court Jurisdictions, Case Types, and Case Stages tables,
 *              creates relational link tables, grants permissions to Public & Authenticated roles,
 *              and seeds initial standard UK Family Court jurisdictions, case types, and stages.
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

function generateDocId(prefix) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4, 10)}`;
}

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Create Core Tables
    await executeSql(ctx, `
      -- 1. Court Jurisdictions
      CREATE TABLE IF NOT EXISTS court_jurisdictions (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(255) NOT NULL UNIQUE,
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
      CREATE INDEX IF NOT EXISTS idx_court_jurisdictions_code ON court_jurisdictions (code);
      CREATE INDEX IF NOT EXISTS idx_court_jurisdictions_docid ON court_jurisdictions (document_id);

      -- 2. Case Types / Proceedings Tracks
      CREATE TABLE IF NOT EXISTS case_types (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(255) NOT NULL UNIQUE,
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
      CREATE INDEX IF NOT EXISTS idx_case_types_code ON case_types (code);
      CREATE INDEX IF NOT EXISTS idx_case_types_docid ON case_types (document_id);

      -- 3. Case Stages
      CREATE TABLE IF NOT EXISTS case_stages (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        key VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "order" INTEGER NOT NULL DEFAULT 1,
        case_type_code VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_case_stages_key ON case_stages (key);
      CREATE INDEX IF NOT EXISTS idx_case_stages_ct_code ON case_stages (case_type_code);
      CREATE INDEX IF NOT EXISTS idx_case_stages_docid ON case_stages (document_id);

      -- 4. Case Stage <-> Case Type Link Table
      CREATE TABLE IF NOT EXISTS case_stages_case_type_lnk (
        id SERIAL PRIMARY KEY,
        case_stage_id INTEGER NOT NULL,
        case_type_id INTEGER NOT NULL,
        case_stage_ord DOUBLE PRECISION DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_cs_ct_stage ON case_stages_case_type_lnk (case_stage_id);
      CREATE INDEX IF NOT EXISTS idx_cs_ct_type ON case_stages_case_type_lnk (case_type_id);
    `);

    // 2. Grant Permissions for Public and Authenticated roles
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::court-jurisdiction.court-jurisdiction.find',
          'api::court-jurisdiction.court-jurisdiction.findOne',
          'api::case-type.case-type.find',
          'api::case-type.case-type.findOne',
          'api::case-stage.case-stage.find',
          'api::case-stage.case-stage.findOne'
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

    // 3. Seed Initial Court Jurisdictions
    await executeSql(ctx, `
      INSERT INTO court_jurisdictions (document_id, name, code, description, "order", is_active)
      VALUES 
        ('court_fam_01', 'Family Court', 'family-court', 'Single Family Court of England and Wales handling private & public law matters', 1, TRUE),
        ('court_hc_02', 'High Court Family Division', 'high-court-family-division', 'High Court of Justice Family Division for complex, international and wardship proceedings', 2, TRUE)
      ON CONFLICT (code) DO UPDATE 
      SET name = EXCLUDED.name, description = EXCLUDED.description, "order" = EXCLUDED."order";
    `);

    // 4. Seed Initial Case Types
    await executeSql(ctx, `
      INSERT INTO case_types (document_id, name, code, description, "order", is_active)
      VALUES 
        ('ctype_pub_01', 'Public Law (Care Proceedings)', 'public-law', 'Care proceedings brought by local authorities under Part IV of the Children Act 1989', 1, TRUE),
        ('ctype_priv_02', 'Private Law (Child Arrangements)', 'private-law', 'Child arrangements applications under Section 8 Children Act 1989 (Live With, Contact)', 2, TRUE),
        ('ctype_da_03', 'Domestic Abuse (Non-Molestation)', 'domestic-abuse', 'Injunctions and protective orders under Part IV Family Law Act 1996', 3, TRUE),
        ('ctype_fin_04', 'Financial Remedies', 'financial-remedies', 'Financial remedy proceedings following divorce/dissolution under Matrimonial Causes Act 1973', 4, TRUE),
        ('ctype_adopt_05', 'Adoption', 'adoption', 'Adoption applications under Adoption and Children Act 2002', 5, TRUE),
        ('ctype_oth_06', 'Other', 'other', 'Miscellaneous or combined family proceedings', 6, TRUE)
      ON CONFLICT (code) DO UPDATE 
      SET name = EXCLUDED.name, description = EXCLUDED.description, "order" = EXCLUDED."order";
    `);

    // 5. Seed Initial Case Stages & Link to Case Types
    const stagesSeed = [
      // Public Law (Care Proceedings)
      { typeCode: 'public-law', key: 'pre-proceedings', name: 'Pre-Proceedings', desc: 'Assessment and pre-proceedings meetings', order: 1 },
      { typeCode: 'public-law', key: 'application', name: 'Application Filed', desc: 'Care application submitted to court', order: 2 },
      { typeCode: 'public-law', key: 'first-hearing', name: 'First Hearing', desc: 'Case Management Hearing (CMH)', order: 3 },
      { typeCode: 'public-law', key: 'directions', name: 'Directions', desc: 'Directions hearing and interim orders', order: 4 },
      { typeCode: 'public-law', key: 'fact-finding', name: 'Fact-Finding', desc: 'Fact-finding hearing', order: 5 },
      { typeCode: 'public-law', key: 'welfare', name: 'Welfare Hearing', desc: 'Welfare assessment and final hearing', order: 6 },
      { typeCode: 'public-law', key: 'final', name: 'Final Order', desc: 'Final order made', order: 7 },

      // Private Law (Child Arrangements)
      { typeCode: 'private-law', key: 'application', name: 'Application Filed', desc: 'C100 application submitted', order: 1 },
      { typeCode: 'private-law', key: 'first-hearing', name: 'First Hearing', desc: 'First Hearing Dispute Resolution Appointment (FHDRA)', order: 2 },
      { typeCode: 'private-law', key: 'mediation', name: 'Mediation/Assessment', desc: 'Mediation or assessment process', order: 3 },
      { typeCode: 'private-law', key: 'directions', name: 'Directions', desc: 'Directions hearing', order: 4 },
      { typeCode: 'private-law', key: 'fact-finding', name: 'Fact-Finding', desc: 'Fact-finding hearing (if required)', order: 5 },
      { typeCode: 'private-law', key: 'welfare', name: 'Welfare Hearing', desc: 'Welfare assessment', order: 6 },
      { typeCode: 'private-law', key: 'final', name: 'Final Hearing', desc: 'Final hearing and order', order: 7 },

      // Domestic Abuse (Non-Molestation)
      { typeCode: 'domestic-abuse', key: 'application', name: 'Application Filed', desc: 'Application for Non-Molestation Order', order: 1 },
      { typeCode: 'domestic-abuse', key: 'without-notice', name: 'Without Notice Hearing', desc: 'Ex parte hearing (if urgent)', order: 2 },
      { typeCode: 'domestic-abuse', key: 'service', name: 'Service', desc: 'Service of application on respondent', order: 3 },
      { typeCode: 'domestic-abuse', key: 'return-hearing', name: 'Return Hearing', desc: 'Return hearing with both parties', order: 4 },
      { typeCode: 'domestic-abuse', key: 'final', name: 'Final Order', desc: 'Final order granted or refused', order: 5 },

      // Financial Remedies
      { typeCode: 'financial-remedies', key: 'application', name: 'Application Filed', desc: 'Financial remedy application', order: 1 },
      { typeCode: 'financial-remedies', key: 'first-appointment', name: 'First Appointment', desc: 'First Directions Appointment (FDA)', order: 2 },
      { typeCode: 'financial-remedies', key: 'disclosure', name: 'Disclosure', desc: 'Financial disclosure process', order: 3 },
      { typeCode: 'financial-remedies', key: 'fdr', name: 'FDR', desc: 'Financial Dispute Resolution hearing', order: 4 },
      { typeCode: 'financial-remedies', key: 'final', name: 'Final Hearing', desc: 'Final hearing and order', order: 5 },

      // Adoption
      { typeCode: 'adoption', key: 'application', name: 'Application Filed', desc: 'Adoption application submitted', order: 1 },
      { typeCode: 'adoption', key: 'first-hearing', name: 'First Hearing', desc: 'First directions hearing', order: 2 },
      { typeCode: 'adoption', key: 'assessment', name: 'Assessment', desc: 'Adoption assessment and reports', order: 3 },
      { typeCode: 'adoption', key: 'final', name: 'Final Hearing', desc: 'Final adoption order hearing', order: 4 },

      // Other
      { typeCode: 'other', key: 'application', name: 'Application Filed', desc: 'Application submitted', order: 1 },
      { typeCode: 'other', key: 'directions', name: 'Directions', desc: 'Directions hearing', order: 2 },
      { typeCode: 'other', key: 'final', name: 'Final Hearing', desc: 'Final hearing', order: 3 },
    ];

    for (let i = 0; i < stagesSeed.length; i++) {
      const s = stagesSeed[i];
      const docId = `stage_${s.typeCode}_${s.key}_${s.order}`;
      await executeSql(ctx, `
        DO $$
        DECLARE
          ct_id INT;
          st_id INT;
        BEGIN
          SELECT id INTO ct_id FROM case_types WHERE code = '${s.typeCode}' LIMIT 1;

          SELECT id INTO st_id FROM case_stages WHERE case_type_code = '${s.typeCode}' AND key = '${s.key}' LIMIT 1;
          IF st_id IS NULL THEN
            INSERT INTO case_stages (document_id, key, name, description, "order", case_type_code, is_active)
            VALUES ('${docId}', '${s.key}', '${s.name.replace(/'/g, "''")}', '${s.desc.replace(/'/g, "''")}', ${s.order}, '${s.typeCode}', TRUE)
            RETURNING id INTO st_id;
          ELSE
            UPDATE case_stages 
            SET name = '${s.name.replace(/'/g, "''")}', description = '${s.desc.replace(/'/g, "''")}', "order" = ${s.order}
            WHERE id = st_id;
          END IF;

          IF ct_id IS NOT NULL AND st_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM case_stages_case_type_lnk WHERE case_stage_id = st_id AND case_type_id = ct_id) THEN
              INSERT INTO case_stages_case_type_lnk (case_stage_id, case_type_id, case_stage_ord)
              VALUES (st_id, ct_id, ${s.order});
            END IF;
          END IF;
        END $$;
      `);
    }
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    // 1. Remove permissions
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::court-jurisdiction.court-jurisdiction.find',
          'api::court-jurisdiction.court-jurisdiction.findOne',
          'api::case-type.case-type.find',
          'api::case-type.case-type.findOne',
          'api::case-stage.case-stage.find',
          'api::case-stage.case-stage.findOne'
        ];
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        FOREACH act IN ARRAY actions
        LOOP
          SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
          IF perm_id IS NOT NULL THEN
            IF pub_role_id IS NOT NULL THEN
              DELETE FROM up_permissions_role_lnk WHERE permission_id = perm_id AND role_id = pub_role_id;
            END IF;
            IF auth_role_id IS NOT NULL THEN
              DELETE FROM up_permissions_role_lnk WHERE permission_id = perm_id AND role_id = auth_role_id;
            END IF;
            DELETE FROM up_permissions WHERE id = perm_id;
          END IF;
        END LOOP;
      END $$;
    `);

    // 2. Drop link tables
    await executeSql(ctx, `
      DROP TABLE IF EXISTS case_stages_case_type_lnk;
    `);

    // 3. Drop core tables
    await executeSql(ctx, `
      DROP TABLE IF EXISTS case_stages;
      DROP TABLE IF EXISTS case_types;
      DROP TABLE IF EXISTS court_jurisdictions;
    `);
  },
};
