---
description: Database configuration, indexing, PostgreSQL connection pooling, and migrations
trigger: always_on
---

# Rule: Database Architecture, Indexing & Migrations

1. **Dual Database Architecture (Local SQLite vs Cloud PostgreSQL)**:
   - **Local Development**: `DATABASE_CLIENT=sqlite` utilizing `better-sqlite3` (`.tmp/data.db`). Zero external server setup required for immediate dev velocity.
   - **Staging / Production**: `DATABASE_CLIENT=postgres` utilizing serverless PostgreSQL (e.g. Neon) via `DATABASE_URL` with SSL connection flags (`rejectUnauthorized: false`).

2. **Connection Pooling & Serverless Resilience**:
   - For Neon serverless connections, keep pool bounds lean (`min: 2, max: 10`) to prevent exhausting connection limits during scaling.
   - Handle transient database dropouts gracefully by letting Strapi manage reconnect retry loops.

3. **Field Indexing Best Practices**:
   - High-cardinality search and filter fields MUST be indexed in their content-type schema definitions:
     - `caseNumber`: unique, required.
     - `clerkId`: unique (on extended User schema).
     - `token`: unique (on `case-invite`).
     - `deadlineDate`: indexed for rapid timeline queries.

4. **Relational Integrity & Orphan Prevention**:
   - When deleting a case, cascade or cleanly detach child hearings, orders, and documents to prevent orphaned database records.
   - Prefer foreign key constraints where supported by the database engine.

5. **Draft & Publish Policy**:
   - For transactional records (`cases`, `orders`, `hearings`, `deadlines`), set `"draftAndPublish": false` in `schema.json` to prevent confusion between draft and published records in CRUD operations.

6. **Mandatory Schema Migration Protocol**:
   - **Zero Ad-Hoc Modifications**: ANY database change (schemas, tables, columns, indexes, foreign keys, or link tables) MUST be committed as a versioned migration script in `database/migrations/`. Manual SQL edits on production/staging are strictly prohibited.
   - **Standardized File Format**: Files must follow `YYYY.MM.DD.HH.MM.SS.<description>.js` exporting both `up(ctx)` (apply) and `down(ctx)` (rollback).
   - **Direct Connection for DDL**: All migrations must use direct unpooled connections (`DATABASE_URL_UNPOOLED`) to guarantee ACID DDL transaction locks.
   - **CLI Tooling**:
     - `npm run db:migrate`: Executes all pending migrations in a batch transaction.
     - `npm run db:migrate:status`: Displays interactive tabular status of applied and pending migrations.
     - `npm run db:migrate:rollback`: Reverts the latest migration batch safely.
     - `npm run db:migrate:create <name>`: Automatically scaffolds a timestamped boilerplate migration.
