---
description: Mandatory TypeScript standards, error handling, and Strapi v5 best practices
trigger: always_on
---

# Rule: Mandatory Backend Coding Standards & Best Practices

1. **Zero `any`**:
   - The `any` type is strictly prohibited in controllers, services, policies, and middlewares.
   - Use strongly typed Strapi context interfaces, explicit DTOs, or `unknown` with runtime type narrowing.

2. **Standardized Error Handling**:
   - Import errors from `@strapi/utils`:
     ```typescript
     import { errors } from '@strapi/utils';
     const { ApplicationError, ValidationError, NotFoundError, ForbiddenError, UnauthorizedError } = errors;
     ```
   - Throw semantic errors:
     - `throw new UnauthorizedError('Authentication token is required')` (HTTP 401)
     - `throw new ForbiddenError('You do not have access to this case')` (HTTP 403)
     - `throw new NotFoundError('Case not found')` (HTTP 404)
     - `throw new ValidationError('Case number is invalid')` (HTTP 400)

3. **File Sizing & Modularity (<200 Lines)**:
   - Keep controllers, services, and policies lean and modular.
   - If a controller or service exceeds 200 lines, extract helper utilities or sub-services (e.g. `notificationService`, `tokenGenerator`).

4. **Strapi v5 Document Service Usage**:
   - Always use the v5 Document Service API:
     ```typescript
     await strapi.documents('api::case.case').findMany({ ... });
     await strapi.documents('api::case.case').findOne({ documentId: id });
     await strapi.documents('api::case.case').create({ data: { ... } });
     await strapi.documents('api::case.case').update({ documentId: id, data: { ... } });
     ```
   - Note that in Strapi v5, entities use `documentId` for draft/published entries and standard querying.

5. **Type Imports**:
   - Always use `import type { Core } from '@strapi/strapi'` for type-only imports.

6. **Environment Variable Centralization**:
   - Never access raw `process.env` directly in business logic.
   - Access environment variables through Strapi config helpers (`env(...)` in `config/`).

7. **Verification Gate**:
   - Always run `npm run build` after any code modification to verify TypeScript correctness and admin panel bundle integrity.
