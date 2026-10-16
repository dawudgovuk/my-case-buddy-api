import type { Core } from '@strapi/strapi';

async function seedDefaultPermissions(strapi: Core.Strapi) {
  try {
    const roles = await strapi.db.query('plugin::users-permissions.role').findMany();

    const authenticatedRole = roles?.find((r: { type: string }) => r.type === 'authenticated');
    const publicRole = roles?.find((r: { type: string }) => r.type === 'public');

    const authenticatedActions = [
      'api::case.case.find',
      'api::case.case.findOne',
      'api::case.case.create',
      'api::case.case.update',
      'api::case.case.delete',
      'api::case.case.findProfessionals',
      'api::case.case.requestPeerSupport',
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
      'api::case-invite.case-invite.accept',
      'api::case.case.acceptPeerSupport',
      'api::document-deadline.document-deadline.find',
      'api::document-deadline.document-deadline.findOne',
      'api::document-deadline.document-deadline.create',
      'api::document-deadline.document-deadline.update',
      'api::document-deadline.document-deadline.delete',
      'plugin::users-permissions.user.find',
      'plugin::users-permissions.user.findOne',
      'plugin::users-permissions.user.me',
    ];

    const publicActions = [
      'api::case.case.find',
      'api::case.case.findOne',
      'api::case.case.create',
      'api::case.case.update',
      'api::case.case.findProfessionals',
      'api::case.case.requestPeerSupport',
      'api::case.case.acceptPeerSupport',
      'api::case-invite.case-invite.accept',
      'api::party.party.find',
      'api::party.party.findOne',
      'api::party.party.create',
      'api::party.party.update',
      'api::hearing.hearing.find',
      'api::hearing.hearing.findOne',
      'api::order.order.find',
      'api::order.order.findOne',
      'api::document.document.find',
      'api::document.document.findOne',
      'api::case-note.case-note.find',
      'api::case-note.case-note.findOne',
      'api::document-deadline.document-deadline.find',
      'api::document-deadline.document-deadline.findOne',
      'api::document-deadline.document-deadline.update',
      'api::case-invite.case-invite.find',
      'api::case-invite.case-invite.findOne',
      'plugin::users-permissions.user.find',
    ];

    if (authenticatedRole) {
      for (const action of authenticatedActions) {
        const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: { action, role: authenticatedRole.id },
        });
        if (!existing) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: authenticatedRole.id },
          });
        }
      }
    }

    if (publicRole) {
      for (const action of publicActions) {
        const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: { action, role: publicRole.id },
        });
        if (!existing) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: publicRole.id },
          });
        }
      }
    }
  } catch (err: unknown) {
    strapi.log.warn('Could not auto-seed default permissions:', err);
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Document Service Middleware for Domain Lifecycle & Validation (SOLID - SRP)
    strapi.documents.use(async (ctx, next) => {
      if (ctx.uid === 'api::case.case' && ctx.action === 'create') {
        const params = ctx.params as { data?: { caseNumber?: string; startedAt?: string } };
        if (params.data) {
          // Auto-generate unique caseNumber if missing (e.g. FC-2026-84920)
          if (!params.data.caseNumber) {
            const year = new Date().getFullYear();
            const randomSuffix = Math.floor(10000 + Math.random() * 90000);
            params.data.caseNumber = `FC-${year}-${randomSuffix}`;
          }
          // Default startedAt to current date if missing
          if (!params.data.startedAt) {
            params.data.startedAt = new Date().toISOString().split('T')[0];
          }
        }
      }

      return next();
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('🚀 My Case Buddy API initialized with SOLID Strapi v5 Architecture');
    await seedDefaultPermissions(strapi);
  },
};
