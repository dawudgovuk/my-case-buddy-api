---
name: security-architect
description: >-
  Guides implementation of custom Strapi policies, RBAC access control,
  token cryptographic verification, and UK GDPR data safeguarding.
---

# Security Architect Skill

This skill enforces security boundaries, route authorization policies, and cryptographic verification in the Strapi backend.

## 1. Creating Custom Strapi Policies

Create policies in `src/policies/<policy-name>.ts`:

```typescript
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { UnauthorizedError, ForbiddenError } = errors;

export default (policyContext, config, { strapi }: { strapi: Core.Strapi }) => {
  const user = policyContext.state.user;

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Admins bypass
  if (user.role?.type === 'admin') {
    return true;
  }

  const caseId = policyContext.params.id || policyContext.params.caseId;
  if (!caseId) {
    return true;
  }

  // Verify ownership or membership logic here
  return true;
};
```

## 2. Attaching Policies to Routes

In `src/api/<entity>/routes/<entity>.ts`:
```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::case.case', {
  config: {
    find: {
      policies: ['global::is-authenticated'],
    },
    findOne: {
      policies: ['global::is-case-member'],
    },
    update: {
      policies: ['global::is-case-member'],
    },
    delete: {
      policies: ['global::is-case-member'],
    },
  },
});
```

## 3. Cryptographic Token Generation

For invitations and secure verification:
```typescript
import crypto from 'crypto';

export function generateSecureInviteToken(): string {
  return crypto.randomUUID();
}

export function computeExpiration(days = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
```
