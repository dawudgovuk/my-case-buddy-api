---
name: database-architect
description: >-
  Guides PostgreSQL (Neon serverless) configuration, SQLite local testing,
  indexing strategies, and schema migrations.
---

# Database Architect Skill

This skill guides database optimization, connection pooling, and migrations.

## 1. Neon PostgreSQL Serverless Integration

In `config/database.ts`:
- Connection string passed via `DATABASE_URL`.
- Client `postgres` maps to `pg`.
- SSL configuration enables TLS with `rejectUnauthorized: false` for serverless environments.
- Connection pooling limits (`min: 2, max: 10`) avoid exhausting pooled connections.

## 2. Schema Normalization & Relations

Content-type mapping guidelines:
- **`Case`** (hub):
  - `oneToMany` to `parties`
  - `oneToMany` to `hearings`
  - `oneToMany` to `orders`
  - `oneToMany` to `documents`
  - `oneToMany` to `notes`
  - `oneToMany` to `deadlines`
  - `oneToMany` to `invites`
  - `manyToOne` to `owner` (users-permissions.user)
- Ensure bidirectional inverse relations are specified (`mappedBy` and `inversedBy`).

## 3. Data Migration from LocalStorage Snapshots

When seeding or migrating data from browser snapshots:
1. Create user records first to obtain Strapi user IDs.
2. Insert Cases with assigned `owner` ID.
3. Insert child entities (parties, hearings, orders) with relation set to the created Case ID.
