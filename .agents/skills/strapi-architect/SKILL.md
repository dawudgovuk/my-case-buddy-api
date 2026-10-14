---
name: strapi-architect
description: >-
  Expert guide for Strapi v5 schema modeling, Document Service API, custom controllers,
  custom services, lifecycle hooks, and clean backend architecture.
---

# Strapi Architect Skill

This skill guides the scaffolding and maintenance of the Strapi v5 backend for **My Case Buddy API**.

## 1. Directory Structure

```
my-case-buddy-api/
├── config/                  # Environment & server/db configuration
├── src/
│   ├── api/                 # Domain feature APIs
│   │   └── <entity>/
│   │       ├── content-types/<entity>/schema.json
│   │       │   └── lifecycles.ts
│   │       ├── controllers/<entity>.ts
│   │       ├── routes/<entity>.ts
│   │       └── services/<entity>.ts
│   ├── extensions/          # Plugin overrides (e.g. users-permissions)
│   ├── policies/            # Reusable route security policies
│   ├── middlewares/         # Custom request middlewares
│   └── index.ts             # Strapi register & bootstrap lifecycle
```

## 2. Controller & Service Implementation Guide

### Core Service Factory Customization
```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::case.case', ({ strapi }) => ({
  async findForUser(userId: number | string, params = {}) {
    return strapi.documents('api::case.case').findMany({
      ...params,
      filters: {
        $or: [
          { owner: { id: { $eq: userId } } },
          // Add membership filters here
        ],
      },
    });
  },
}));
```

### Core Controller Factory Customization
```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::case.case', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    // Call service abstraction
    const data = await strapi.service('api::case.case').findForUser(user.id, ctx.query);
    return { data };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    // Attach authenticated user as case owner
    ctx.request.body.data = {
      ...ctx.request.body.data,
      owner: user.id,
    };

    return super.create(ctx);
  },
}));
```

## 3. Lifecycle Hooks

Store lifecycle hooks in `src/api/<entity>/content-types/<entity>/lifecycles.ts`:
```typescript
export default {
  beforeCreate(event) {
    const { data } = event.params;
    if (!data.caseNumber) {
      const year = new Date().getFullYear();
      const random = Math.floor(10000 + Math.random() * 90000);
      data.caseNumber = `FC-${year}-${random}`;
    }
  },
};
```
