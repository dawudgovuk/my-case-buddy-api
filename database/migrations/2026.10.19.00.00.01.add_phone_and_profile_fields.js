/**
 * Migration: 2026.10.19.00.00.01.add_phone_and_profile_fields.js
 * Description: Adds phone column to up_users and ensures user profile update permissions are granted.
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
    // 1. Add phone column to up_users if not exists
    await executeSql(ctx, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'up_users') THEN
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        END IF;
      END $$;
    `);

    // 2. Ensure user update permissions are linked to authenticated role
    await executeSql(ctx, `
      DO $$
      DECLARE
        auth_role_id INT;
        perm_id INT;
        act TEXT := 'plugin::users-permissions.user.update';
      BEGIN
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        -- Ensure action exists in up_permissions
        SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
        IF perm_id IS NULL THEN
          INSERT INTO up_permissions (action, created_at, updated_at)
          VALUES (act, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id INTO perm_id;
        END IF;

        -- Link to authenticated role
        IF auth_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM up_permissions_role_lnk
            WHERE permission_id = perm_id AND role_id = auth_role_id
          ) THEN
            INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
            VALUES (perm_id, auth_role_id, 1);
          END IF;
        END IF;
      END $$;
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'up_users' AND column_name = 'phone'
        ) THEN
          ALTER TABLE up_users DROP COLUMN phone;
        END IF;
      END $$;
    `);
  },
};
