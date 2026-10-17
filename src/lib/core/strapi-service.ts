import type { Core } from '@strapi/strapi';

/**
 * Base class for domain services that need the Strapi instance.
 * Subclasses get a protected `strapi` handle and a namespaced logger,
 * keeping framework access in one place (Dependency Inversion).
 */
export abstract class StrapiService {
  protected constructor(protected readonly strapi: Core.Strapi) {}

  protected get log(): Core.Strapi['log'] {
    return this.strapi.log;
  }
}
