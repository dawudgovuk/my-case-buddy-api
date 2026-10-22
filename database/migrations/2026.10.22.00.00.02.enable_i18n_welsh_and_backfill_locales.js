/**
 * Migration: 2026.10.22.00.00.02.enable_i18n_welsh_and_backfill_locales.js
 * Description: Registers Welsh (cy) locale in Strapi i18n_locale, backfills existing
 *              content rows to default 'en' locale, and adjusts unique constraints to
 *              be locale-scoped (column, locale) across all localized tables.
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
    // 1. Register Welsh (cy) locale in i18n_locale if not present
    await executeSql(ctx, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'i18n_locale') THEN
          IF NOT EXISTS (SELECT 1 FROM i18n_locale WHERE code = 'cy') THEN
            INSERT INTO i18n_locale (document_id, name, code, created_at, updated_at, published_at)
            VALUES ('welsh_cy_official_locale_uk', 'Welsh (cy)', 'cy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
          END IF;
        END IF;
      END $$;
    `);

    // 2. Backfill existing records with locale = 'en' where locale is NULL
    const targetTables = [
      'guidance_articles',
      'guidance_steps',
      'guidance_journeys',
      'guidance_maps',
      'guidance_references',
      'case_presets',
      'case_stages',
      'case_types',
      'cases',
      'case_notes',
      'documents',
    ];

    for (const table of targetTables) {
      await executeSql(ctx, `
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'locale'
          ) THEN
            UPDATE ${table} SET locale = 'en' WHERE locale IS NULL;
          END IF;
        END $$;
      `);
    }

    // 3. Relax single-column UNIQUE constraints to locale-scoped UNIQUE indexes
    // Guidance Articles: slug
    await executeSql(ctx, `
      ALTER TABLE guidance_articles DROP CONSTRAINT IF EXISTS guidance_articles_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_articles_slug_locale ON guidance_articles (slug, locale);
    `);

    // Guidance Steps: slug
    await executeSql(ctx, `
      ALTER TABLE guidance_steps DROP CONSTRAINT IF EXISTS guidance_steps_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_steps_slug_locale ON guidance_steps (slug, locale);
    `);

    // Guidance Journeys: slug
    await executeSql(ctx, `
      ALTER TABLE guidance_journeys DROP CONSTRAINT IF EXISTS guidance_journeys_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_journeys_slug_locale ON guidance_journeys (slug, locale);
    `);

    // Guidance Maps: slug
    await executeSql(ctx, `
      ALTER TABLE guidance_maps DROP CONSTRAINT IF EXISTS guidance_maps_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_maps_slug_locale ON guidance_maps (slug, locale);
    `);

    // Guidance References: slug
    await executeSql(ctx, `
      ALTER TABLE guidance_references DROP CONSTRAINT IF EXISTS guidance_references_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_references_slug_locale ON guidance_references (slug, locale);
    `);

    // Case Presets: preset_key
    await executeSql(ctx, `
      ALTER TABLE case_presets DROP CONSTRAINT IF EXISTS case_presets_preset_key_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_case_presets_preset_key_locale ON case_presets (preset_key, locale);
    `);

    // Case Types: name and code
    await executeSql(ctx, `
      ALTER TABLE case_types DROP CONSTRAINT IF EXISTS case_types_name_key;
      ALTER TABLE case_types DROP CONSTRAINT IF EXISTS case_types_code_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_case_types_code_locale ON case_types (code, locale);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_case_types_name_locale ON case_types (name, locale);
    `);

    // 4. Create compound (document_id, locale) indexes on all target tables for Strapi 5 Document queries
    for (const table of targetTables) {
      await executeSql(ctx, `
        CREATE INDEX IF NOT EXISTS idx_${table}_doc_locale ON ${table} (document_id, locale);
        CREATE INDEX IF NOT EXISTS idx_${table}_locale ON ${table} (locale);
      `);
    }
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    // 1. Remove Welsh locale
    await executeSql(ctx, `
      DELETE FROM i18n_locale WHERE code = 'cy';
    `);

    // 2. Drop compound indexes and restore original unique constraints if needed
    await executeSql(ctx, `
      DROP INDEX IF EXISTS idx_guidance_articles_slug_locale;
      ALTER TABLE guidance_articles ADD CONSTRAINT guidance_articles_slug_key UNIQUE (slug);

      DROP INDEX IF EXISTS idx_guidance_steps_slug_locale;
      ALTER TABLE guidance_steps ADD CONSTRAINT guidance_steps_slug_key UNIQUE (slug);

      DROP INDEX IF EXISTS idx_guidance_journeys_slug_locale;
      ALTER TABLE guidance_journeys ADD CONSTRAINT guidance_journeys_slug_key UNIQUE (slug);

      DROP INDEX IF EXISTS idx_guidance_maps_slug_locale;
      ALTER TABLE guidance_maps ADD CONSTRAINT guidance_maps_slug_key UNIQUE (slug);

      DROP INDEX IF EXISTS idx_guidance_references_slug_locale;
      ALTER TABLE guidance_references ADD CONSTRAINT guidance_references_slug_key UNIQUE (slug);

      DROP INDEX IF EXISTS idx_case_presets_preset_key_locale;
      ALTER TABLE case_presets ADD CONSTRAINT case_presets_preset_key_key UNIQUE (preset_key);

      DROP INDEX IF EXISTS idx_case_types_code_locale;
      DROP INDEX IF EXISTS idx_case_types_name_locale;
      ALTER TABLE case_types ADD CONSTRAINT case_types_name_key UNIQUE (name);
      ALTER TABLE case_types ADD CONSTRAINT case_types_code_key UNIQUE (code);
    `);

    // 3. Drop query performance indexes
    const targetTables = [
      'guidance_articles',
      'guidance_steps',
      'guidance_journeys',
      'guidance_maps',
      'guidance_references',
      'case_presets',
      'case_stages',
      'case_types',
      'cases',
      'case_notes',
      'documents',
    ];

    for (const table of targetTables) {
      await executeSql(ctx, `
        DROP INDEX IF EXISTS idx_${table}_doc_locale;
        DROP INDEX IF EXISTS idx_${table}_locale;
      `);
    }
  },
};
