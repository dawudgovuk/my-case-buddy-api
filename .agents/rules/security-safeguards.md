---
description: Security, UK GDPR, data privacy, and role-based access control rules
trigger: always_on
---

# Rule: Security, Data Privacy & Safeguarding Standards

1. **Family Court Confidentiality (UK Family Procedure Rules - FPR)**:
   - Case data (proceedings, child arrangements, non-molestation orders, allegations) is legally restricted.
   - Unauthorized disclosure is a serious legal violation.
   - All case endpoints (`api::case.case`, `api::hearing.hearing`, `api::party.party`, `api::order.order`, `api::document.document`, `api::case-note.case-note`) MUST enforce user ownership or verified membership.

2. **Insecure Direct Object Reference (IDOR) Prevention**:
   - Never allow users to read or mutate a case by simply guessing an ID or caseNumber.
   - Before returning or modifying case data:
     1. Verify the requester is authenticated (`ctx.state.user`).
     2. Verify `ctx.state.user.id === case.owner.id` OR that the user is an active collaborator in `case.members`.
     3. Reject unauthorized access immediately with `ForbiddenError`.

3. **Cryptographically Secure Tokens**:
   - Collaboration invites (`api::case-invite.case-invite`) MUST generate cryptographically secure UUID tokens using Node's native `crypto.randomUUID()`.
   - Never use sequential integers, math.random(), or guessable timestamps.
   - Tokens must have an expiration timestamp (`expiresAt`), typically 30 days from creation.
   - Expired or already used tokens must be rejected with `ValidationError('Invite has expired or already been accepted')`.

4. **Webhook Security (Clerk / External Services)**:
   - Webhook endpoints must validate incoming payload integrity (e.g. verifying Svix headers or shared secret tokens).
   - Reject malformed or unauthorized webhook calls with HTTP 400 or 401.

5. **Upload & File Safeguards**:
   - Limit uploads to approved document MIME types (`application/pdf`, `application/vnd.openxmlformats-officedocument.*`, image formats).
   - Executable extensions (`.exe`, `.sh`, `.bin`, `.bat`, `.cmd`) and SVG files are strictly prohibited.
