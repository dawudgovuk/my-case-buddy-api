---
name: api-tester
description: >-
  Procedures for endpoint health probes, curl testing, JWT verification,
  and testing relational population contracts.
---

# API Tester Skill

This skill provides testing procedures for verifying the Strapi REST API endpoints.

## 1. Quick Health Check Probe

```bash
# Verify Strapi server is responding
curl -I http://localhost:1337/admin
```

## 2. Testing Endpoints & Permissions

```bash
# Public ping (Expected 403 when unauthenticated, confirming security is active)
curl -i http://localhost:1337/api/cases

# Query with JWT Token
curl -i -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:1337/api/cases?populate=*
```

## 3. Verifying Populated Relations

Ensure relational fields (`parties`, `hearings`, `orders`, `deadlines`) populate correctly by appending `?populate=*` or deep population `?populate[parties]=*&populate[hearings]=*`.
