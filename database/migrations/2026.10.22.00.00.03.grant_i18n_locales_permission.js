/**
 * Migration: 2026.10.22.00.00.03.grant_i18n_locales_permission.js
 * Description: Grants Public and Authenticated roles permission to list active i18n locales.
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
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        perm_id INT;
        action_name TEXT := 'plugin::i18n.locales.listLocales';
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        -- 1. Ensure permission row exists for listLocales
        SELECT id INTO perm_id FROM up_permissions WHERE action = action_name LIMIT 1;
        IF perm_id IS NULL THEN
          INSERT INTO up_permissions (document_id, action, created_at, updated_at, published_at)
          VALUES ('perm_i18n_list_locales', action_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id INTO perm_id;
        END IF;

        -- 2. Link to Public role if not linked
        IF pub_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM up_permissions_role_lnk 
            WHERE permission_id = perm_id AND role_id = pub_role_id
          ) THEN
            INSERT INTO up_permissions_role_lnk (permission_id, role_id)
            VALUES (perm_id, pub_role_id);
          END IF;
        END IF;

        -- 3. Link to Authenticated role if not linked
        IF auth_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM up_permissions_role_lnk 
            WHERE permission_id = perm_id AND role_id = auth_role_id
          ) THEN
            INSERT INTO up_permissions_role_lnk (permission_id, role_id)
            VALUES (perm_id, auth_role_id);
          END IF;
        END IF;
      END $$;
    `);
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DO $$
      DECLARE
        perm_id INT;
      BEGIN
        SELECT id INTO perm_id FROM up_permissions WHERE action = 'plugin::i18n.locales.listLocales' LIMIT 1;
        IF perm_id IS NOT NULL THEN
          DELETE FROM up_permissions_role_lnk WHERE permission_id = perm_id;
          DELETE FROM up_permissions WHERE id = perm_id;
        END IF;
      END $$;
    `);
  },
};
