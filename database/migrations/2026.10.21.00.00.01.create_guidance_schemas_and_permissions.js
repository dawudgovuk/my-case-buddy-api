  /**
 * Migration: 2026.10.21.00.00.01.create_guidance_schemas_and_permissions.js
 * Description: Scaffolds guidance schema tables (maps, journeys, steps, articles, references),
 *              relational link tables, and grants read permissions to Public and Authenticated roles.
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
    // 1. Core Guidance Tables
    await executeSql(ctx, `
      -- 1. Guidance Maps
      CREATE TABLE IF NOT EXISTS guidance_maps (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(255),
        preconditions TEXT,
        postconditions TEXT,
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_guidance_maps_slug ON guidance_maps (slug);

      -- 2. Guidance Journeys
      CREATE TABLE IF NOT EXISTS guidance_journeys (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        type VARCHAR(255),
        "order" INTEGER DEFAULT 1,
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_guidance_journeys_slug ON guidance_journeys (slug);

      -- 3. Guidance Steps
      CREATE TABLE IF NOT EXISTS guidance_steps (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        "order" INTEGER DEFAULT 1,
        is_conditional BOOLEAN DEFAULT FALSE,
        condition_criteria TEXT,
        category VARCHAR(255),
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_guidance_steps_slug ON guidance_steps (slug);

      -- 4. Guidance Articles
      CREATE TABLE IF NOT EXISTS guidance_articles (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        content TEXT,
        keywords VARCHAR(255),
        category VARCHAR(255),
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_guidance_articles_slug ON guidance_articles (slug);

      -- 5. Guidance References
      CREATE TABLE IF NOT EXISTS guidance_references (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        url TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'Form',
        keywords VARCHAR(255),
        locale VARCHAR(255),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_guidance_references_slug ON guidance_references (slug);
    `);

    // 2. Relational Link Tables
    await executeSql(ctx, `
      -- Maps <-> Journeys link table
      CREATE TABLE IF NOT EXISTS guidance_maps_journeys_lnk (
        id SERIAL PRIMARY KEY,
        guidance_map_id INTEGER NOT NULL,
        guidance_journey_id INTEGER NOT NULL,
        guidance_journey_ord DOUBLE PRECISION DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_gmj_map ON guidance_maps_journeys_lnk (guidance_map_id);
      CREATE INDEX IF NOT EXISTS idx_gmj_journey ON guidance_maps_journeys_lnk (guidance_journey_id);

      -- Journeys <-> Steps link table
      CREATE TABLE IF NOT EXISTS guidance_journeys_steps_lnk (
        id SERIAL PRIMARY KEY,
        guidance_journey_id INTEGER NOT NULL,
        guidance_step_id INTEGER NOT NULL,
        guidance_step_ord DOUBLE PRECISION DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_gjs_journey ON guidance_journeys_steps_lnk (guidance_journey_id);
      CREATE INDEX IF NOT EXISTS idx_gjs_step ON guidance_journeys_steps_lnk (guidance_step_id);

      -- Steps <-> Articles link table
      CREATE TABLE IF NOT EXISTS guidance_steps_articles_lnk (
        id SERIAL PRIMARY KEY,
        guidance_step_id INTEGER NOT NULL,
        guidance_article_id INTEGER NOT NULL,
        guidance_article_ord DOUBLE PRECISION DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_gsa_step ON guidance_steps_articles_lnk (guidance_step_id);
      CREATE INDEX IF NOT EXISTS idx_gsa_article ON guidance_steps_articles_lnk (guidance_article_id);

      -- Articles <-> References link table
      CREATE TABLE IF NOT EXISTS guidance_articles_references_lnk (
        id SERIAL PRIMARY KEY,
        guidance_article_id INTEGER NOT NULL,
        guidance_reference_id INTEGER NOT NULL,
        guidance_reference_ord DOUBLE PRECISION DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_gar_article ON guidance_articles_references_lnk (guidance_article_id);
      CREATE INDEX IF NOT EXISTS idx_gar_reference ON guidance_articles_references_lnk (guidance_reference_id);
    `);

    // 3. Permissions in up_permissions & up_permissions_role_lnk for Public & Authenticated roles
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::guidance-map.guidance-map.find',
          'api::guidance-map.guidance-map.findOne',
          'api::guidance-journey.guidance-journey.find',
          'api::guidance-journey.guidance-journey.findOne',
          'api::guidance-step.guidance-step.find',
          'api::guidance-step.guidance-step.findOne',
          'api::guidance-article.guidance-article.find',
          'api::guidance-article.guidance-article.findOne',
          'api::guidance-reference.guidance-reference.find',
          'api::guidance-reference.guidance-reference.findOne'
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
          'api::guidance-map.guidance-map.find',
          'api::guidance-map.guidance-map.findOne',
          'api::guidance-journey.guidance-journey.find',
          'api::guidance-journey.guidance-journey.findOne',
          'api::guidance-step.guidance-step.find',
          'api::guidance-step.guidance-step.findOne',
          'api::guidance-article.guidance-article.find',
          'api::guidance-article.guidance-article.findOne',
          'api::guidance-reference.guidance-reference.find',
          'api::guidance-reference.guidance-reference.findOne'
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
      DROP TABLE IF EXISTS guidance_articles_references_lnk;
      DROP TABLE IF EXISTS guidance_steps_articles_lnk;
      DROP TABLE IF EXISTS guidance_journeys_steps_lnk;
      DROP TABLE IF EXISTS guidance_maps_journeys_lnk;
    `);

    // 3. Drop core tables
    await executeSql(ctx, `
      DROP TABLE IF EXISTS guidance_references;
      DROP TABLE IF EXISTS guidance_articles;
      DROP TABLE IF EXISTS guidance_steps;
      DROP TABLE IF EXISTS guidance_journeys;
      DROP TABLE IF EXISTS guidance_maps;
    `);
  },
};
