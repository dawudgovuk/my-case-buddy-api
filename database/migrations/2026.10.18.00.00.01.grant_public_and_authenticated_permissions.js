/**
 * Migration: 2026.10.18.00.00.01.grant_public_and_authenticated_permissions.js
 * Description: Grants required content API permissions to Public and Authenticated roles in Strapi v5
 *              (using up_permissions and the up_permissions_role_lnk relational link table).
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
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::case.case.find',
          'api::case.case.findOne',
          'api::case.case.create',
          'api::case.case.update',
          'api::case.case.delete',
          'api::case.case.findProfessionals',
          'api::case.case.requestPeerSupport',
          'api::case.case.acceptPeerSupport',
          'api::party.party.find',
          'api::party.party.findOne',
          'api::party.party.create',
          'api::party.party.update',
          'api::party.party.delete',
          'api::hearing.hearing.find',
          'api::hearing.hearing.findOne',
          'api::hearing.hearing.create',
          'api::hearing.hearing.update',
          'api::hearing.hearing.delete',
          'api::order.order.find',
          'api::order.order.findOne',
          'api::order.order.create',
          'api::order.order.update',
          'api::order.order.delete',
          'api::document.document.find',
          'api::document.document.findOne',
          'api::document.document.create',
          'api::document.document.update',
          'api::document.document.delete',
          'api::case-note.case-note.find',
          'api::case-note.case-note.findOne',
          'api::case-note.case-note.create',
          'api::case-note.case-note.update',
          'api::case-note.case-note.delete',
          'api::case-invite.case-invite.find',
          'api::case-invite.case-invite.findOne',
          'api::case-invite.case-invite.create',
          'api::case-invite.case-invite.update',
          'api::case-invite.case-invite.delete',
          'api::case-invite.case-invite.accept',
          'api::document-deadline.document-deadline.find',
          'api::document-deadline.document-deadline.findOne',
          'api::document-deadline.document-deadline.create',
          'api::document-deadline.document-deadline.update',
          'api::document-deadline.document-deadline.delete',
          'api::auth-notification.auth-notification.sendRegistrationEmails',
          'plugin::users-permissions.user.find',
          'plugin::users-permissions.user.findOne',
          'plugin::users-permissions.user.me'
        ];
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        IF pub_role_id IS NOT NULL THEN
          FOREACH act IN ARRAY actions
          LOOP
            -- 1. Ensure action exists in up_permissions
            SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
            IF perm_id IS NULL THEN
              INSERT INTO up_permissions (action, created_at, updated_at)
              VALUES (act, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id INTO perm_id;
            END IF;

            -- 2. Link to Public role in up_permissions_role_lnk
            IF NOT EXISTS (
              SELECT 1 FROM up_permissions_role_lnk 
              WHERE permission_id = perm_id AND role_id = pub_role_id
            ) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (perm_id, pub_role_id, 1);
            END IF;

            -- 3. Link to Authenticated role in up_permissions_role_lnk
            IF auth_role_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM up_permissions_role_lnk 
              WHERE permission_id = perm_id AND role_id = auth_role_id
            ) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
              VALUES (perm_id, auth_role_id, 1);
            END IF;
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
      DO $$
      DECLARE
        pub_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::case.case.find',
          'api::case.case.findOne',
          'api::case.case.create',
          'api::case.case.update',
          'api::case.case.delete',
          'api::case.case.findProfessionals',
          'api::case.case.requestPeerSupport',
          'api::case.case.acceptPeerSupport',
          'api::party.party.find',
          'api::party.party.findOne',
          'api::party.party.create',
          'api::party.party.update',
          'api::party.party.delete',
          'api::hearing.hearing.find',
          'api::hearing.hearing.findOne',
          'api::hearing.hearing.create',
          'api::hearing.hearing.update',
          'api::hearing.hearing.delete',
          'api::order.order.find',
          'api::order.order.findOne',
          'api::order.order.create',
          'api::order.order.update',
          'api::order.order.delete',
          'api::document.document.find',
          'api::document.document.findOne',
          'api::document.document.create',
          'api::document.document.update',
          'api::document.document.delete',
          'api::case-note.case-note.find',
          'api::case-note.case-note.findOne',
          'api::case-note.case-note.create',
          'api::case-note.case-note.update',
          'api::case-note.case-note.delete',
          'api::case-invite.case-invite.find',
          'api::case-invite.case-invite.findOne',
          'api::case-invite.case-invite.create',
          'api::case-invite.case-invite.update',
          'api::case-invite.case-invite.delete',
          'api::case-invite.case-invite.accept',
          'api::document-deadline.document-deadline.find',
          'api::document-deadline.document-deadline.findOne',
          'api::document-deadline.document-deadline.create',
          'api::document-deadline.document-deadline.update',
          'api::document-deadline.document-deadline.delete',
          'api::auth-notification.auth-notification.sendRegistrationEmails',
          'plugin::users-permissions.user.find',
          'plugin::users-permissions.user.findOne',
          'plugin::users-permissions.user.me'
        ];
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        IF pub_role_id IS NOT NULL THEN
          FOREACH act IN ARRAY actions
          LOOP
            SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
            IF perm_id IS NOT NULL THEN
              DELETE FROM up_permissions_role_lnk 
              WHERE permission_id = perm_id AND role_id = pub_role_id;
            END IF;
          END LOOP;
        END IF;
      END $$;
    `);
  },
};
