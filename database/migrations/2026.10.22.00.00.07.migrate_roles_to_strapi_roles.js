/**
 * Migration: 2026.10.22.00.00.07.migrate_roles_to_strapi_roles.js
 * Description: Creates dedicated Strapi Users & Permissions roles (LIP, McKenzie Friend, Solicitor, Barrister),
 *              clones baseline authenticated permissions, and migrates existing users to their corresponding Strapi role.
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
        lip_role_id INT;
        mck_role_id INT;
        sol_role_id INT;
        bar_role_id INT;
        target_role_id INT;
        u_rec RECORD;
        p_rec RECORD;
      BEGIN
        -- 1. Identify existing Authenticated role ID for baseline permissions
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;
        IF auth_role_id IS NULL THEN
          RAISE NOTICE 'Authenticated role not found. Proceeding with caution.';
        END IF;

        -- 2. Insert or find 'Litigant in Person' role (type: 'lip')
        SELECT id INTO lip_role_id FROM up_roles WHERE type = 'lip' LIMIT 1;
        IF lip_role_id IS NULL THEN
          INSERT INTO up_roles (
            document_id, name, description, type, created_at, updated_at, published_at
          ) VALUES (
            lower(substr(md5(random()::text) || md5(random()::text), 1, 24)),
            'Litigant in Person',
            'Litigant in person managing their family court case.',
            'lip',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id INTO lip_role_id;
          RAISE NOTICE 'Created Strapi role: Litigant in Person (id: %)', lip_role_id;
        END IF;

        -- 3. Insert or find 'McKenzie Friend' role (type: 'mckenzie_friend')
        SELECT id INTO mck_role_id FROM up_roles WHERE type = 'mckenzie_friend' LIMIT 1;
        IF mck_role_id IS NULL THEN
          INSERT INTO up_roles (
            document_id, name, description, type, created_at, updated_at, published_at
          ) VALUES (
            lower(substr(md5(random()::text) || md5(random()::text), 1, 24)),
            'McKenzie Friend',
            'Lay support assistant providing peer assistance to litigants in court.',
            'mckenzie_friend',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id INTO mck_role_id;
          RAISE NOTICE 'Created Strapi role: McKenzie Friend (id: %)', mck_role_id;
        END IF;

        -- 4. Insert or find 'Solicitor' role (type: 'solicitor')
        SELECT id INTO sol_role_id FROM up_roles WHERE type = 'solicitor' LIMIT 1;
        IF sol_role_id IS NULL THEN
          INSERT INTO up_roles (
            document_id, name, description, type, created_at, updated_at, published_at
          ) VALUES (
            lower(substr(md5(random()::text) || md5(random()::text), 1, 24)),
            'Solicitor',
            'Regulated legal professional authorized to conduct litigation.',
            'solicitor',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id INTO sol_role_id;
          RAISE NOTICE 'Created Strapi role: Solicitor (id: %)', sol_role_id;
        END IF;

        -- 5. Insert or find 'Barrister' role (type: 'barrister')
        SELECT id INTO bar_role_id FROM up_roles WHERE type = 'barrister' LIMIT 1;
        IF bar_role_id IS NULL THEN
          INSERT INTO up_roles (
            document_id, name, description, type, created_at, updated_at, published_at
          ) VALUES (
            lower(substr(md5(random()::text) || md5(random()::text), 1, 24)),
            'Barrister',
            'Regulated legal advocate authorized to represent clients in court.',
            'barrister',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id INTO bar_role_id;
          RAISE NOTICE 'Created Strapi role: Barrister (id: %)', bar_role_id;
        END IF;

        -- 6. Clone all permissions from Authenticated role into each new custom role
        IF auth_role_id IS NOT NULL THEN
          FOR p_rec IN (SELECT permission_id FROM up_permissions_role_lnk WHERE role_id = auth_role_id)
          LOOP
            -- Clone to LIP
            IF NOT EXISTS (SELECT 1 FROM up_permissions_role_lnk WHERE role_id = lip_role_id AND permission_id = p_rec.permission_id) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (p_rec.permission_id, lip_role_id, 1);
            END IF;

            -- Clone to McKenzie Friend
            IF NOT EXISTS (SELECT 1 FROM up_permissions_role_lnk WHERE role_id = mck_role_id AND permission_id = p_rec.permission_id) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (p_rec.permission_id, mck_role_id, 1);
            END IF;

            -- Clone to Solicitor
            IF NOT EXISTS (SELECT 1 FROM up_permissions_role_lnk WHERE role_id = sol_role_id AND permission_id = p_rec.permission_id) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (p_rec.permission_id, sol_role_id, 1);
            END IF;

            -- Clone to Barrister
            IF NOT EXISTS (SELECT 1 FROM up_permissions_role_lnk WHERE role_id = bar_role_id AND permission_id = p_rec.permission_id) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (p_rec.permission_id, bar_role_id, 1);
            END IF;
          END LOOP;
          RAISE NOTICE 'Cloned permissions from Authenticated role to all 4 domain roles.';
        END IF;

        -- 7. Backfill existing users in up_users_role_lnk based on up_users.user_role
        FOR u_rec IN (SELECT id, user_role FROM up_users)
        LOOP
          IF u_rec.user_role = 'McKenzieFriend' THEN
            target_role_id := mck_role_id;
          ELSIF u_rec.user_role = 'Solicitor' THEN
            target_role_id := sol_role_id;
          ELSIF u_rec.user_role = 'Barrister' THEN
            target_role_id := bar_role_id;
          ELSE
            target_role_id := lip_role_id;
          END IF;

          -- Upsert link into up_users_role_lnk
          IF EXISTS (SELECT 1 FROM up_users_role_lnk WHERE user_id = u_rec.id) THEN
            UPDATE up_users_role_lnk SET role_id = target_role_id WHERE user_id = u_rec.id;
          ELSE
            INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
            VALUES (u_rec.id, target_role_id, 1);
          END IF;
        END LOOP;
        RAISE NOTICE 'Backfilled existing users into their respective Strapi roles.';

      END $$;
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DO $$
      DECLARE
        auth_role_id INT;
        role_rec RECORD;
      BEGIN
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        -- 1. Point any users in custom roles back to default Authenticated role
        IF auth_role_id IS NOT NULL THEN
          FOR role_rec IN (SELECT id FROM up_roles WHERE type IN ('lip', 'mckenzie_friend', 'solicitor', 'barrister'))
          LOOP
            UPDATE up_users_role_lnk SET role_id = auth_role_id WHERE role_id = role_rec.id;
          END LOOP;
        END IF;

        -- 2. Delete permission links for custom roles
        DELETE FROM up_permissions_role_lnk
        WHERE role_id IN (SELECT id FROM up_roles WHERE type IN ('lip', 'mckenzie_friend', 'solicitor', 'barrister'));

        -- 3. Delete the custom roles
        DELETE FROM up_roles WHERE type IN ('lip', 'mckenzie_friend', 'solicitor', 'barrister');

        RAISE NOTICE 'Reverted custom Strapi roles back to default Authenticated role.';
      END $$;
    `);
  },
};
