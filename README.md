# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>




## 🗄️ Database Management & Migration Scripts

> **MANDATORY POLICY**: Any database schema change (tables, columns, indexes, foreign keys, or link tables) requires a versioned migration in `database/migrations/`. See [System Architecture & Workflow Manual](../docs/SYSTEM_ARCHITECTURE_AND_WORKFLOW.md).

```bash
# Check status of migrations (shows APPLIED vs PENDING)
npm run db:migrate:status

# Apply all pending migrations in an ACID transaction
npm run db:migrate

# Rollback latest migration batch
npm run db:migrate:rollback

# Scaffold a new timestamped migration file
npm run db:migrate:create <migration_name>

# Clean database to fresh production state (clears all users, sessions, and case data)
npm run db:fresh
# or
npm run db:clean

# Clean only registered users & auth sessions (Neon Auth + Strapi)
npm run db:clean-users

# Seed realistic UK Family Court test data & pre-configured accounts
npm run db:seed

# Reset and seed in a single command
npm run db:reset
```

### Pre-Configured Test Accounts (Available when running `npm run db:seed`)

| Role | Email / Identifier | Password | Name / Description |
| :--- | :--- | :--- | :--- |
| **LIP (Litigant in Person)** | `lip@example.com` | `Password123!` | Alex Morgan (Owner of test cases) |
| **McKenzie Friend** | `mckenzie@example.com` | `Password123!` | Sarah Jenkins (Specialisms: Child Arrangements, FHDRA, DRA) |
| **McKenzie Friend (Peer)** | `kevin.mckenzie@example.com` | `Password123!` | Kevin Moore (Specialisms: Domestic Abuse, Procedural Advice) |
| **Solicitor** | `solicitor@example.com` | `Password123!` | David Vance (Vance & Partners Family Law LLP) |
| **Solicitor** | `hannah.solicitor@example.com` | `Password123!` | Hannah Brown (Brown & Co Solicitors) |
| **Barrister** | `barrister@example.com` | `Password123!` | Eleanor Rigby KC (Apex Family Chambers, London) |
| **Barrister** | `oliver.barrister@example.com` | `Password123!` | Oliver Anderson (Temple Gate Chambers) |