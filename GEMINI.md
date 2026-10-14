# Antigravity Gemini Directives — My Case Buddy API

These directives apply to all Gemini agent interactions in the `my-case-buddy-api` repository.

## Operational Directives

1. **Architecture & SOLID First**:
   - Enforce clean layering: Route -> Policy -> Controller -> Service -> Document Service.
   - Keep controllers thin and delegate all business logic to services.
   - Use policies for authentication and authorization checks.

2. **TypeScript & Type Safety**:
   - Strict TypeScript: No `any`. Use `unknown` with type narrowing if payload shapes are uncertain.
   - Leverage Strapi v5 `Core` types from `@strapi/strapi`.

3. **Data Protection & Legal Safeguards**:
   - All court case data is confidential. Strictly verify `owner` or `membership` before reading/modifying cases, hearings, parties, or orders.
   - Generate cryptographically secure tokens (`crypto.randomUUID()`) for case collaboration invites.

4. **Verification Gate**:
   - Always run `npm run build` after modifying TypeScript files in `my-case-buddy-api` to ensure no compile or bundling errors.
