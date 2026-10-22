import type { Core } from '@strapi/strapi';
import { caseDefaultsMiddleware } from './lib/bootstrap/case-defaults.middleware';
import { PermissionSeeder } from './lib/bootstrap/permission-seeder';
import { registerUserRoleLifecycle } from './lib/bootstrap/user-role-sync.lifecycle';

export default {
  /** Runs before the application is initialised. */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.documents.use(caseDefaultsMiddleware);
  },

  /** Runs before the application starts. */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.log.info('🚀 My Case Buddy API initialized with SOLID Strapi v5 Architecture');
    registerUserRoleLifecycle(strapi);
    await new PermissionSeeder(strapi).seed();
  },
};
