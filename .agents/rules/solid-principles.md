---
description: SOLID Principles and Clean Architecture design patterns for Strapi v5
trigger: always_on
---

# Rule: SOLID Principles & Clean Architecture for Strapi v5 Backend

1. **Single Responsibility Principle (SRP)**:
   - **Routes** (`src/api/*/routes/*.ts`): Only define URL route endpoints, HTTP methods, middlewares, and policies. Do NOT embed logic.
   - **Policies** (`src/policies/*.ts`): Solely evaluate whether the requesting user (`ctx.state.user`) is permitted to perform the action. Throw standard Strapi errors or return `true`.
   - **Controllers** (`src/api/*/controllers/*.ts`): Solely parse incoming HTTP payloads (`ctx.request.body`), query parameters, route params, invoke the service, and set HTTP status codes.
   - **Services** (`src/api/*/services/*.ts`): Solely encapsulate business logic, domain transformations, and persistence operations.
   - **Lifecycles** (`src/api/*/content-types/*/lifecycles.ts`): Solely manage event side effects (generating sequence numbers, audit logging, sending notifications).

2. **Open/Closed Principle (OCP)**:
   - Extend Strapi's core framework methods via factory extension callbacks (`factories.createCoreController('api::case.case', ({ strapi }) => ({ ... }))`) rather than modifying framework code or hacking core files.
   - Add new features (e.g., PDF generation, email alerts, payment sync) as independent services that can be injected without altering core controllers.

3. **Liskov Substitution Principle (LSP)**:
   - Any customized core controller or service must remain interchangeable with the standard Strapi `Core.Controller` / `Core.Service` interface.
   - Customized `find`, `findOne`, `create`, `update`, and `delete` methods must accept standard Strapi Context (`ctx`) and return conforming data contracts.

4. **Interface Segregation Principle (ISP)**:
   - Explicitly define TypeScript interfaces for Request DTOs and Response DTOs.
   - Use Strapi's `fields` and `populate` projection query parameters to avoid loading entire deep relational trees when a client only requires basic summary fields.

5. **Dependency Inversion Principle (DIP)**:
   - High-level business logic in controllers must depend on Service abstractions (`strapi.service('api::case.case')`), not on direct database drivers (`knex`, raw SQL, or internal ORM tables).
   - Strapi's Document Service (`strapi.documents('api::...')`) provides the persistence abstraction, allowing transparent switching between SQLite (local) and PostgreSQL (Neon production).
