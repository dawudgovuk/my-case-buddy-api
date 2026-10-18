/**
 * Migration: 2026.10.18.00.00.04.sync_neon_auth_mackenzi2.js
 * Description: Synchronizes registered Neon Auth user 'mackenzi2' (mackenzi2@yopmail.com)
 *              into Strapi's up_users and up_users_role_lnk as a verified McKenzie Friend.
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
        auth_role_id INT;
        target_user_id INT;
      BEGIN
        -- Resolve Authenticated role ID
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;
        IF auth_role_id IS NULL THEN
          auth_role_id := 1;
        END IF;

        -- Check if mackenzi2 already exists in up_users
        SELECT id INTO target_user_id FROM up_users WHERE email = 'mackenzi2@yopmail.com' LIMIT 1;

        IF target_user_id IS NULL THEN
          INSERT INTO up_users (
            document_id,
            username,
            email,
            name,
            user_role,
            subscription_tier,
            subscription_status,
            bio,
            years_experience,
            specialisms,
            confirmed,
            blocked,
            provider,
            created_at,
            updated_at,
            published_at
          ) VALUES (
            substring(md5(random()::text || clock_timestamp()::text) from 1 for 24),
            'mackenzi2',
            'mackenzi2@yopmail.com',
            'mackenzi2',
            'McKenzieFriend',
            'professional',
            'active',
            'Verified McKenzie Friend providing procedural guidance, position statement assistance, and court hearing support for litigants in person.',
            3,
            '["Child Arrangements", "Position Statements", "Court Support", "Hearings"]'::jsonb,
            TRUE,
            FALSE,
            'local',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING id INTO target_user_id;

          -- Link to Authenticated role
          INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
          VALUES (target_user_id, auth_role_id, 1)
          ON CONFLICT DO NOTHING;
        ELSE
          -- Ensure user_role and verified fields are set
          UPDATE up_users
          SET
            name = COALESCE(name, 'mackenzi2'),
            user_role = 'McKenzieFriend',
            subscription_tier = 'professional',
            subscription_status = 'active',
            bio = COALESCE(bio, 'Verified McKenzie Friend providing procedural guidance, position statement assistance, and court hearing support for litigants in person.'),
            years_experience = COALESCE(years_experience, 3),
            specialisms = COALESCE(specialisms, '["Child Arrangements", "Position Statements", "Court Support", "Hearings"]'::jsonb),
            confirmed = TRUE,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = target_user_id;

          IF NOT EXISTS (SELECT 1 FROM up_users_role_lnk WHERE user_id = target_user_id AND role_id = auth_role_id) THEN
            INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
            VALUES (target_user_id, auth_role_id, 1);
          END IF;
        END IF;

        -- Also ensure neon_auth.user emailVerified flag is updated if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'neon_auth' AND table_name = 'user') THEN
          UPDATE neon_auth.user
          SET "emailVerified" = TRUE
          WHERE email = 'mackenzi2@yopmail.com';
        END IF;
      END $$;
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DELETE FROM up_users WHERE email = 'mackenzi2@yopmail.com';
    `);
  },
};
