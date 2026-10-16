/**
 * Migration: 2026.10.16.00.00.01.init_neon_auth_and_user_extensions.js
 * Description: Sets up Neon Auth (Better Auth) schema, custom Strapi user extensions, and indexing.
 */

async function executeSql(ctx, sql) {
  if (typeof ctx.raw === 'function') {
    return ctx.raw(sql);
  }
  if (typeof ctx.query === 'function') {
    return ctx.query(sql);
  }
  throw new Error('Unsupported migration context: neither ctx.raw nor ctx.query is available');
}

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Ensure neon_auth schema exists for Better Auth integration
    await executeSql(ctx, `
      CREATE SCHEMA IF NOT EXISTS neon_auth;

      CREATE TABLE IF NOT EXISTS neon_auth.user (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        "emailVerified" BOOLEAN DEFAULT false,
        image TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS neon_auth.session (
        id VARCHAR(255) PRIMARY KEY,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ipAddress" VARCHAR(255),
        "userAgent" TEXT,
        "userId" VARCHAR(255) NOT NULL REFERENCES neon_auth.user(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS neon_auth.account (
        id VARCHAR(255) PRIMARY KEY,
        "accountId" VARCHAR(255) NOT NULL,
        "providerId" VARCHAR(255) NOT NULL,
        "userId" VARCHAR(255) NOT NULL REFERENCES neon_auth.user(id) ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMPTZ,
        "refreshTokenExpiresAt" TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS neon_auth.verification (
        id VARCHAR(255) PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure Strapi up_users has all extended fields
    await executeSql(ctx, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'up_users') THEN
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS user_role VARCHAR(50) DEFAULT 'LIP';
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255);
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS firm VARCHAR(255);
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS registration_number VARCHAR(255);
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS bio TEXT;
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS specialisms JSONB;
          ALTER TABLE up_users ADD COLUMN IF NOT EXISTS years_experience INTEGER;
        END IF;
      END $$;
    `);

    // 3. Performance indexes on up_users
    await executeSql(ctx, `
      CREATE INDEX IF NOT EXISTS idx_up_users_email_lower ON up_users (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_up_users_user_role ON up_users (user_role);
      CREATE INDEX IF NOT EXISTS idx_up_users_clerk_id ON up_users (clerk_id);
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DROP INDEX IF EXISTS idx_up_users_clerk_id;
      DROP INDEX IF EXISTS idx_up_users_user_role;
      DROP INDEX IF EXISTS idx_up_users_email_lower;
    `);
  },
};

