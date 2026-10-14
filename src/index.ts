import type { Core } from '@strapi/strapi';

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
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('🚀 My Case Buddy API initialized with SOLID Strapi v5 Architecture');
  },
};
