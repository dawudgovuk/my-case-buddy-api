---
name: task-orchestrator
description: >-
  Standardized 6-phase autonomous execution protocol for backend feature implementation,
  SOLID validation, and verification gates.
---

# Task Orchestrator Protocol — Backend

Follow this 6-phase protocol for all backend development tasks:

1. **Phase 1: Discovery**
   - Read schema definitions in `src/api/*/content-types/*/schema.json`.
   - Inspect existing routes, controllers, and services.

2. **Phase 2: Architecture & SOLID Check**
   - Check SRP: ensure logic is placed in services, not controllers.
   - Check OCP: use factory customization callbacks.
   - Check DIP: ensure dependencies use Strapi Document Service abstractions.

3. **Phase 3: Persona Selection**
   - Declare active persona (e.g. `[Strapi-Core-Engineer]`, `[Security-Architect]`).

4. **Phase 4: Implementation**
   - Make precise, non-destructive code edits.
   - Preserve comments and docstrings.

5. **Phase 5: Verification Gate**
   - Run `npm run build` in `my-case-buddy-api` and verify exit code 0.

6. **Phase 6: Traceability**
   - Document changes and API contracts.
