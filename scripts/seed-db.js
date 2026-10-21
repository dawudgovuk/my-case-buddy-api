/**
 * seed-db.js
 *
 * Seeds comprehensive, realistic UK Family Court test data into Strapi PostgreSQL & Neon Auth.
 * Populates:
 * 1. Neon Managed Better Auth (neon_auth.user, neon_auth.account) with Better Auth scrypt password hashes
 * 2. Strapi Users-Permissions (up_users, up_users_role_lnk) with bcrypt password hashes
 * 3. Verified UK legal professionals across all roles (LIP, McKenzie Friend, Solicitor, Barrister)
 * 4. 4 realistic Family Court cases with complete relational children:
 *    - Parties (with representation, parental responsibility, school/nursery, FPR 3A special measures)
 *    - Hearings (with remote platform, CVP/Teams links, outcome summary, special measures)
 *    - Court Orders (with penal notice warnings, compliance directions)
 *    - Case Documents (with file size, status, page count, exhibit references)
 *    - Case Notes (with legal categories: Legal Strategy, Hearing Attendance, Telephone Attendance, etc.)
 *    - Document Deadlines (with status, submission timestamps, assignee links)
 *    - Case Invites (with tokens and roles)
 * 5. Full UK Family Court Guidance Roadmap (Maps, Journeys, Steps, Articles, References)
 *
 * Usage:
 *   node scripts/seed-db.js
 *   npm run db:seed
 *   npm run db:reset
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { createId } = require('@paralleldrive/cuid2');
const { seedGuidance } = require('./seed-guidance');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const connectionString = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '').replace('-pooler.', '.');

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

const DEFAULT_PASSWORD = 'Password123!';

/**
 * Generates Better Auth compliant scrypt password hash: `${salt}:${key}`
 */
async function hashBetterAuthPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey))
    );
  });
  return `${salt}:${key.toString('hex')}`;
}

async function seedDatabase() {
  console.log('🌱 Starting My Case Buddy Complete Database Seeding...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL (Neon).');

    // 1. Get Authenticated Role from Strapi
    const roleRes = await client.query(
      `SELECT id FROM up_roles WHERE type = 'authenticated' LIMIT 1;`
    );
    if (roleRes.rows.length === 0) {
      throw new Error("Could not find 'authenticated' role in up_roles.");
    }
    const authenticatedRoleId = roleRes.rows[0].id;
    console.log(`🔑 Strapi Authenticated Role ID: ${authenticatedRoleId}`);

    // Pre-compute password hashes
    const bcryptPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const betterAuthPassword = await hashBetterAuthPassword(DEFAULT_PASSWORD);
    const now = new Date();

    // 2. Define Comprehensive Personas
    const usersToSeed = [
      // Primary LIP Account
      {
        username: 'lip_user',
        email: 'lip@mycasebuddy.co.uk',
        name: 'Alex Morgan',
        userRole: 'LIP',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        bio: 'Litigant in Person navigating child arrangements and family court proceedings.',
      },
      {
        username: 'lip_example',
        email: 'lip@example.com',
        name: 'Alex Morgan',
        userRole: 'LIP',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        bio: 'Litigant in Person navigating child arrangements and family court proceedings.',
      },
      {
        username: 'lip1_user',
        email: 'lip1@yopmail.com',
        name: 'Alex Morgan (LIP)',
        userRole: 'LIP',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        bio: 'Litigant in Person navigating child arrangements and family court proceedings.',
      },

      // McKenzie Friends
      {
        username: 'sarah_mckenzie',
        email: 'mckenzie@mycasebuddy.co.uk',
        name: 'Sarah Jenkins',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Experienced McKenzie Friend with 6+ years supporting litigants in person through Child Arrangements disputes, position statement drafting, and court hearings.',
        yearsExperience: 6,
        specialisms: JSON.stringify([
          'Child Arrangements (Live with / Spend time with)',
          'FHDRA Preparation & Position Statements',
          'CAFCASS Section 7 Safeguarding Analysis',
        ]),
      },
      {
        username: 'sarah_example',
        email: 'mckenzie@example.com',
        name: 'Sarah Jenkins',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Experienced McKenzie Friend with 6+ years supporting litigants in person through Child Arrangements disputes, position statement drafting, and court hearings.',
        yearsExperience: 6,
        specialisms: JSON.stringify([
          'Child Arrangements (Live with / Spend time with)',
          'FHDRA Preparation & Position Statements',
        ]),
      },
      {
        username: 'mackenzi1_user',
        email: 'mackenzi1@yopmail.com',
        name: 'Mackenzie One',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Specialist McKenzie Friend offering procedural advice and emotional support for family court proceedings.',
        yearsExperience: 5,
        specialisms: JSON.stringify([
          'FPR PD 27A Court Bundles',
          'Fact-Finding & Evidence',
        ]),
      },
      {
        username: 'mackenzi2_user',
        email: 'mackenzi2@yopmail.com',
        name: 'Mackenzie Two',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'McKenzie Friend experienced in domestic abuse allegations, non-molestation orders, and safeguarding responses.',
        yearsExperience: 3,
        specialisms: JSON.stringify(['Domestic Abuse & Non-Molestation']),
      },

      // Solicitors
      {
        username: 'david_solicitor',
        email: 'solicitor@mycasebuddy.co.uk',
        name: 'David Vance',
        userRole: 'Solicitor',
        firm: 'Vance & Partners Family Law LLP',
        registrationNumber: 'SRA-682910',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Senior Family Law Solicitor specializing in complex child arrangements and financial remedies.',
        yearsExperience: 14,
        specialisms: JSON.stringify(['Care Proceedings', 'Financial Remedies', 'Child Arrangements (Live with / Spend time with)']),
      },
      {
        username: 'david_example',
        email: 'solicitor@example.com',
        name: 'David Vance',
        userRole: 'Solicitor',
        firm: 'Vance & Partners Family Law LLP',
        registrationNumber: 'SRA-682910',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Senior Family Law Solicitor specializing in complex child arrangements and financial remedies.',
        yearsExperience: 14,
        specialisms: JSON.stringify(['Care Proceedings', 'Financial Remedies']),
      },

      // Barristers
      {
        username: 'eleanor_barrister',
        email: 'barrister@mycasebuddy.co.uk',
        name: 'Eleanor Rigby KC',
        userRole: 'Barrister',
        firm: 'Apex Family Chambers, London',
        registrationNumber: 'BSB-49201',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: "King's Counsel specializing in High Court family division appeals, contested care orders, and multi-day fact-finding hearings.",
        yearsExperience: 20,
        specialisms: JSON.stringify(['Fact-Finding & Evidence', 'Financial Remedies']),
      },
      {
        username: 'eleanor_example',
        email: 'barrister@example.com',
        name: 'Eleanor Rigby KC',
        userRole: 'Barrister',
        firm: 'Apex Family Chambers, London',
        registrationNumber: 'BSB-49201',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: "King's Counsel specializing in High Court family division appeals, contested care orders, and multi-day fact-finding hearings.",
        yearsExperience: 20,
        specialisms: JSON.stringify(['Fact-Finding & Evidence', 'Financial Remedies']),
      },
      {
        username: 'barister1_user',
        email: 'barister1@yopmail.com',
        name: 'Barrister One KC',
        userRole: 'Barrister',
        firm: 'Temple Gate Chambers',
        registrationNumber: 'BSB-55312',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Family law barrister with substantial advocacy experience in financial remedies and dispute resolution.',
        yearsExperience: 12,
        specialisms: JSON.stringify(['Financial Remedies', 'Child Arrangements (Live with / Spend time with)']),
      },
    ];

    // Check if Neon Auth table exists
    const neonTableCheck = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'neon_auth' AND table_name = 'user');`
    );
    const hasNeonAuth = neonTableCheck.rows[0].exists;

    console.log(`👥 Seeding ${usersToSeed.length} user accounts across Neon Auth & Strapi...`);
    const seededStrapiUsers = {};
    const seededNeonUsers = {};

    for (const u of usersToSeed) {
      // 2A. Seed Neon Auth (Better Auth) if table exists
      if (hasNeonAuth) {
        let neonUserId = crypto.randomUUID();
        const existingNeon = await client.query(
          `SELECT id FROM neon_auth."user" WHERE email = $1 LIMIT 1;`,
          [u.email.toLowerCase()]
        );

        if (existingNeon.rows.length > 0) {
          neonUserId = existingNeon.rows[0].id;
          await client.query(
            `UPDATE neon_auth."user" 
             SET name = $1, "emailVerified" = true, role = 'user', "updatedAt" = $2 
             WHERE id = $3;`,
            [u.name, now, neonUserId]
          );
        } else {
          await client.query(
            `INSERT INTO neon_auth."user" (
               id, name, email, "emailVerified", role, "createdAt", "updatedAt"
             ) VALUES ($1, $2, $3, true, 'user', $4, $5);`,
            [neonUserId, u.name, u.email.toLowerCase(), now, now]
          );
        }
        seededNeonUsers[u.email.toLowerCase()] = neonUserId;

        // Upsert Neon Auth Account (credential provider with scrypt hash)
        const existingAccount = await client.query(
          `SELECT id FROM neon_auth."account" WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1;`,
          [neonUserId]
        );

        if (existingAccount.rows.length > 0) {
          await client.query(
            `UPDATE neon_auth."account" 
             SET password = $1, "updatedAt" = $2 
             WHERE id = $3;`,
            [betterAuthPassword, now, existingAccount.rows[0].id]
          );
        } else {
          const accountId = crypto.randomUUID();
          await client.query(
            `INSERT INTO neon_auth."account" (
               id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
             ) VALUES ($1, $2, 'credential', $3, $4, $5, $6);`,
            [accountId, neonUserId, neonUserId, betterAuthPassword, now, now]
          );
        }
      }

      // 2B. Seed Strapi up_users
      const existingStrapi = await client.query(
        `SELECT id, document_id FROM up_users WHERE email = $1 LIMIT 1;`,
        [u.email.toLowerCase()]
      );

      let strapiUser;
      if (existingStrapi.rows.length > 0) {
        const updateSql = `
          UPDATE up_users SET
            name = $1,
            username = $2,
            password = $3,
            user_role = $4,
            subscription_tier = $5,
            subscription_status = $6,
            firm = $7,
            registration_number = $8,
            bio = $9,
            specialisms = $10,
            years_experience = $11,
            confirmed = true,
            blocked = false,
            updated_at = $12
          WHERE id = $13
          RETURNING id, document_id, username, email, user_role;
        `;
        const res = await client.query(updateSql, [
          u.name,
          u.username,
          bcryptPassword,
          u.userRole,
          u.subscriptionTier || 'free',
          u.subscriptionStatus || 'active',
          u.firm || null,
          u.registrationNumber || null,
          u.bio || null,
          u.specialisms || null,
          u.yearsExperience || null,
          now,
          existingStrapi.rows[0].id,
        ]);
        strapiUser = res.rows[0];
      } else {
        const docId = createId();
        const insertSql = `
          INSERT INTO up_users (
            document_id, username, email, password, provider, confirmed, blocked,
            name, user_role, subscription_tier, subscription_status, firm,
            registration_number, bio, specialisms, years_experience,
            created_at, updated_at, published_at
          ) VALUES (
            $1, $2, $3, $4, 'local', true, false,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16
          ) RETURNING id, document_id, username, email, user_role;
        `;
        const res = await client.query(insertSql, [
          docId,
          u.username,
          u.email.toLowerCase(),
          bcryptPassword,
          u.name,
          u.userRole,
          u.subscriptionTier || 'free',
          u.subscriptionStatus || 'active',
          u.firm || null,
          u.registrationNumber || null,
          u.bio || null,
          u.specialisms || null,
          u.yearsExperience || null,
          now,
          now,
          now,
        ]);
        strapiUser = res.rows[0];
      }

      seededStrapiUsers[u.email.toLowerCase()] = strapiUser;

      // Link to Strapi Authenticated Role
      const existingLnk = await client.query(
        `SELECT id FROM up_users_role_lnk WHERE user_id = $1 LIMIT 1;`,
        [strapiUser.id]
      );
      if (existingLnk.rows.length === 0) {
        await client.query(
          `INSERT INTO up_users_role_lnk (user_id, role_id, user_ord) VALUES ($1, $2, 1);`,
          [strapiUser.id, authenticatedRoleId]
        );
      }

      console.log(`   ✓ ${strapiUser.user_role.padEnd(14)} | ${strapiUser.email} (${strapiUser.username})`);
    }

    // Resolvers for ease of access
    const primaryLip = seededStrapiUsers['lip@mycasebuddy.co.uk'];
    const exampleLip = seededStrapiUsers['lip@example.com'];
    const yopmailLip = seededStrapiUsers['lip1@yopmail.com'];

    const primaryMckenzie = seededStrapiUsers['mckenzie@mycasebuddy.co.uk'];
    const exampleMckenzie = seededStrapiUsers['mckenzie@example.com'];
    const yopmailMckenzie1 = seededStrapiUsers['mackenzi1@yopmail.com'];
    const yopmailMckenzie2 = seededStrapiUsers['mackenzi2@yopmail.com'];

    const primarySolicitor = seededStrapiUsers['solicitor@mycasebuddy.co.uk'];
    const exampleSolicitor = seededStrapiUsers['solicitor@example.com'];

    const primaryBarrister = seededStrapiUsers['barrister@mycasebuddy.co.uk'];
    const exampleBarrister = seededStrapiUsers['barrister@example.com'];
    const yopmailBarrister1 = seededStrapiUsers['barister1@yopmail.com'];

    // Collect all LIP user IDs so all 3 accounts have full visibility into the cases
    const allLipUserIds = [primaryLip?.id, exampleLip?.id, yopmailLip?.id].filter(Boolean);

    // 3. Clear existing case hierarchy to ensure idempotent clean seed
    console.log('\n🧹 Refreshing Family Court case hierarchy records...');
    const caseTables = [
      'case_invites_used_by_lnk',
      'case_invites_case_lnk',
      'case_invites',
      'document_deadlines_assigned_to_lnk',
      'document_deadlines_case_lnk',
      'document_deadlines',
      'case_notes_case_lnk',
      'case_notes',
      'documents_case_lnk',
      'documents',
      'orders_case_lnk',
      'orders',
      'hearings_case_lnk',
      'hearings',
      'parties_case_lnk',
      'parties',
      'cases_members_lnk',
      'cases_owner_lnk',
      'cases',
    ];
    await client.query(`TRUNCATE TABLE ${caseTables.join(', ')} RESTART IDENTITY CASCADE;`);

    // 4. Define 4 Realistic Cases
    const casesToSeed = [
      // Case 1: Private Law Child Arrangements
      {
        caseNumber: 'FC-2026-10492',
        title: 'In the matter of Leo & Maya Morgan (Child Arrangements)',
        court: 'Central Family Court',
        caseType: 'Private Law (Child Arrangements)',
        status: 'Open',
        startedAt: '2026-01-15',
        allocatedJudge: 'HHJ Henderson',
        currentStage: 'First Hearing Dispute Resolution Appointment (FHDRA)',
        childrenInvolved: 2,
        seekingPeerSupport: true,
        peerSupportNote:
          'Seeking an experienced McKenzie Friend or parent who has attended an FHDRA to help review my Position Statement and advise on the Cafcass Section 7 process.',
        peerSupportRequestedAt: now,
        ownerId: primaryLip.id,
        memberIds: [
          exampleLip?.id,
          yopmailLip?.id,
          primaryMckenzie?.id,
          exampleMckenzie?.id,
          yopmailMckenzie1?.id,
        ].filter(Boolean),
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            dateOfBirth: '1988-06-12',
            address: '14 St. Jude Street, Islington, London N1 2PL',
            contactEmail: 'lip@mycasebuddy.co.uk',
            contactPhone: '+44 7700 900123',
            representation: 'Litigant in Person',
            parentalResponsibility: true,
          },
          {
            role: 'Respondent',
            firstName: 'Claire',
            lastName: 'Morgan',
            dateOfBirth: '1990-09-24',
            address: '28 Kensington Park Gardens, London W11 2ET',
            solicitorFirm: 'Sterling Family Law LLP',
            solicitorContact: 'Emma Watson (+44 20 7946 0892)',
            contactEmail: 'claire.morgan.legal@example.com',
            representation: 'Instructed Solicitor',
            parentalResponsibility: true,
            specialMeasuresRequired: 'Separate waiting room, Screens in court',
          },
          {
            role: 'Child',
            firstName: 'Leo',
            lastName: 'Morgan',
            dateOfBirth: '2018-04-10',
            schoolOrNursery: 'St Mary Primary School (Year 3)',
            parentalResponsibility: false,
          },
          {
            role: 'Child',
            firstName: 'Maya',
            lastName: 'Morgan',
            dateOfBirth: '2021-08-15',
            schoolOrNursery: 'Little Stars Nursery (Pre-School)',
            parentalResponsibility: false,
          },
          {
            role: 'Guardian',
            firstName: 'Rachel',
            lastName: 'Green',
            solicitorFirm: 'Cafcass London & Greater South',
            contactEmail: 'rachel.green@cafcass.gov.uk',
            contactPhone: '+44 300 003 2323',
          },
        ],
        hearings: [
          {
            type: 'Case Management',
            date: '2026-11-12',
            time: '10:00',
            location: 'Central Family Court, First Avenue House, Courtroom 4',
            judge: 'HHJ Henderson',
            notes: 'First Hearing Dispute Resolution Appointment (FHDRA). Review Cafcass safeguarding letter; identify issues in dispute.',
            outcome: 'Pending hearing listing.',
            outcomeSummary: 'Listing confirmed. Directions given for filing position statements 3 days prior.',
            remotePlatform: 'CVP',
            remoteLink: 'https://meet.cvp.hmcts.net/court-4-fhdra-10492',
            specialMeasures: 'Screens, Separate waiting room',
          },
          {
            type: 'Directions',
            date: '2026-12-18',
            time: '14:00',
            location: 'Central Family Court, First Avenue House, Courtroom 2',
            judge: 'DJ Patel',
            notes: 'Dispute Resolution Appointment (DRA). Review Cafcass Section 7 report and testing of weekend contact arrangements.',
            outcomeSummary: 'Listing for 1-hour DRA appointment.',
            remotePlatform: 'In-Person',
            specialMeasures: 'Separate waiting room',
          },
        ],
        orders: [
          {
            type: 'Child Arrangements Order',
            dateMade: '2026-02-10',
            summary:
              'Interim contact order: Children spend alternating weekends from Friday 16:00 to Sunday 18:00 with the Applicant, plus weekly Wednesday video call between 18:00 and 18:30.',
            expiresOn: '2026-12-31',
            documentUrl: 'https://example.com/orders/interim-cao-fc-10492.pdf',
            hasPenalNotice: false,
            complianceDeadlines: JSON.stringify([
              {
                id: 'comp-1',
                direction: 'Applicant to confirm weekend pickup time via text 24h prior',
                assignedParty: 'Applicant',
                dueDate: '2026-11-01',
                completed: true,
              },
              {
                id: 'comp-2',
                direction: 'Cafcass Section 7 report home visit interview attendance',
                assignedParty: 'Respondent',
                dueDate: '2026-11-15',
                completed: false,
              },
            ]),
          },
        ],
        documents: [
          {
            title: 'Form C100 Child Arrangements Application',
            type: 'Application',
            url: 'https://example.com/docs/c100-application.pdf',
            notes: 'Original sealed application submitted to Central Family Court on 15 Jan 2026.',
            fileName: 'c100-child-arrangements.pdf',
            fileSize: 245000,
            mimeType: 'application/pdf',
            status: 'Filed',
            pageCount: 22,
            exhibitRef: 'EX-1',
          },
          {
            title: 'Applicant First Position Statement for FHDRA',
            type: 'Statement',
            url: 'https://example.com/docs/applicant-position-statement-1.pdf',
            notes: 'Drafted with McKenzie Friend support outlining current care schedule and proposed holiday sharing.',
            fileName: 'applicant-position-statement-1.pdf',
            fileSize: 112000,
            mimeType: 'application/pdf',
            status: 'Filed',
            pageCount: 4,
            exhibitRef: 'PS-1',
          },
          {
            title: 'Cafcass Schedule 2 Safeguarding Enquiries Letter',
            type: 'Expert Report',
            url: 'https://example.com/docs/cafcass-schedule2.pdf',
            notes: 'Police and local authority screening complete with no safeguarding markers identified.',
            fileName: 'cafcass-schedule2-letter.pdf',
            fileSize: 320000,
            mimeType: 'application/pdf',
            status: 'Served',
            pageCount: 8,
            exhibitRef: 'CF-1',
          },
          {
            title: 'FPR PD 27A Core Trial Bundle',
            type: 'Bundle',
            url: 'https://example.com/docs/core-bundle.pdf',
            notes: 'Indexed hearing bundle complying with 350-page maximum statutory limit.',
            fileName: 'pd27a-trial-bundle-vol1.pdf',
            fileSize: 1850000,
            mimeType: 'application/pdf',
            status: 'Draft',
            pageCount: 142,
            exhibitRef: 'BD-1',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            category: 'General Note',
            text: 'Submitted Form C100 application to the court and received case number FC-2026-10492. Fee remission verified via Help with Fees.',
          },
          {
            author: 'Sarah Jenkins',
            category: 'Telephone Attendance',
            text: 'Telephone attendance with Alex Morgan. Reviewed initial Cafcass safeguarding letter. Safeguarding checks are completely clear. Advised focusing position statement on practical school routines and handover times.',
          },
          {
            author: 'Alex Morgan',
            category: 'Client Conference',
            text: 'Conference with Sarah Jenkins (McKenzie Friend) to review draft position statement and finalize chronology of care.',
          },
          {
            author: 'Alex Morgan',
            category: 'Legal Strategy',
            text: 'Filed draft position statement with court administration via email and served copy on respondent solicitor (Sterling Family Law).',
          },
        ],
        deadlines: [
          {
            title: 'File and Serve Position Statement for FHDRA',
            description: 'Provide 2-page position statement to the court and respondent at least 3 business days before hearing.',
            deadlineDate: '2026-11-05',
            documentType: 'Position Statement',
            status: 'pending',
            assignedToId: primaryLip.id,
          },
          {
            title: 'Cafcass Section 7 Report Filing Deadline',
            description: 'Cafcass Family Court Advisor to file Section 7 welfare report.',
            deadlineDate: '2026-12-01',
            documentType: 'Section 7 Welfare Report',
            status: 'pending',
          },
          {
            title: 'Serve Form C100 & Notice of Hearing on Respondent',
            description: 'Personal service of notice pack on respondent party.',
            deadlineDate: '2026-01-25',
            documentType: 'C100 & Notice',
            status: 'submitted',
            submittedAt: '2026-01-24T14:30:00.000Z',
            assignedToId: primaryLip.id,
          },
        ],
        invites: [
          {
            token: 'INVITE-MF-784912',
            role: 'McKenzieFriend',
            expiresAt: '2026-12-31T23:59:59.000Z',
          },
          {
            token: 'INVITE-SOL-392015',
            role: 'Solicitor',
            expiresAt: '2026-12-31T23:59:59.000Z',
          },
        ],
      },

      // Case 2: Public Law Care Proceedings
      {
        caseNumber: 'FC-2026-28194',
        title: 'London Borough of Camden v Davies (Care Proceedings s.31)',
        court: 'Camden Family Court',
        caseType: 'Public Law (Care Proceedings)',
        status: 'Open',
        startedAt: '2026-03-01',
        allocatedJudge: 'HHJ Campbell',
        currentStage: 'Issues Resolution Hearing (IRH)',
        childrenInvolved: 1,
        seekingPeerSupport: false,
        ownerId: primaryLip.id,
        memberIds: [
          exampleLip?.id,
          yopmailLip?.id,
          primarySolicitor?.id,
          exampleSolicitor?.id,
        ].filter(Boolean),
        parties: [
          {
            role: 'Applicant',
            firstName: 'London Borough of Camden',
            lastName: 'Children Services',
            solicitorFirm: 'Camden Legal Services',
            solicitorContact: 'Robert Hughes (+44 20 7974 4444)',
            contactEmail: 'legal.children@camden.gov.uk',
            representation: 'Instructed Solicitor',
          },
          {
            role: 'Respondent',
            firstName: 'Alex',
            lastName: 'Morgan',
            dateOfBirth: '1988-06-12',
            contactEmail: 'lip@mycasebuddy.co.uk',
            representation: 'Litigant in Person',
            parentalResponsibility: true,
          },
          {
            role: 'Child',
            firstName: 'Ethan',
            lastName: 'Davies',
            dateOfBirth: '2022-02-14',
            schoolOrNursery: 'Rainbow Community Nursery',
            parentalResponsibility: false,
          },
          {
            role: 'Guardian',
            firstName: 'Sarah',
            lastName: 'Palmer',
            solicitorFirm: 'Cafcass Legal',
            contactEmail: 'sarah.palmer@cafcass.gov.uk',
            representation: 'Instructed Solicitor',
          },
        ],
        hearings: [
          {
            type: 'Case Management',
            date: '2026-11-20',
            time: '10:30',
            location: 'Camden Family Court, Court 1',
            judge: 'HHJ Campbell',
            notes: 'Issues Resolution Hearing to determine final care plan or list contested final hearing.',
            outcomeSummary: 'Hearing listed for full day IRH with CVP remote attendance permitted.',
            remotePlatform: 'CVP',
            remoteLink: 'https://meet.cvp.hmcts.net/camden-court-1-irh-28194',
            specialMeasures: 'Separate waiting room',
          },
        ],
        orders: [
          {
            type: 'Supervision Order',
            dateMade: '2026-03-15',
            summary: 'Interim supervision order granted to local authority pending independent parenting assessment.',
            expiresOn: '2026-11-30',
            documentUrl: 'https://example.com/orders/interim-supervision-order.pdf',
            hasPenalNotice: false,
          },
        ],
        documents: [
          {
            title: 'Local Authority Section 31 Care Application & Threshold Document',
            type: 'Application',
            url: 'https://example.com/docs/s31-care-application.pdf',
            notes: 'Contains formal threshold criteria alleged under s.31(2) Children Act 1989.',
            fileName: 's31-care-application.pdf',
            fileSize: 390000,
            mimeType: 'application/pdf',
            status: 'Served',
            pageCount: 35,
            exhibitRef: 'LA-1',
          },
          {
            title: 'Independent Social Work Parenting Assessment',
            type: 'Expert Report',
            url: 'https://example.com/docs/parenting-assessment.pdf',
            notes: 'Comprehensive positive assessment recommending transition back to parental care.',
            fileName: 'parenting-assessment.pdf',
            fileSize: 512000,
            mimeType: 'application/pdf',
            status: 'Filed',
            pageCount: 56,
            exhibitRef: 'SW-1',
          },
        ],
        notes: [
          {
            author: 'David Vance',
            category: 'Hearing Attendance',
            text: 'Attended Case Management Conference before HHJ Campbell. Threshold criteria clarified. Court approved instruction of Independent Social Worker.',
          },
          {
            author: 'David Vance',
            category: 'Legal Strategy',
            text: 'Reviewed independent social work assessment. Finding is highly supportive of our position. Preparing response to threshold criteria and draft supervision transition plan.',
          },
        ],
        deadlines: [
          {
            title: 'Submit Response to Final Social Work Evidence',
            description: 'Respondent skeleton argument and witness statement in response to Camden care plan.',
            deadlineDate: '2026-11-10',
            documentType: 'Threshold Response',
            status: 'pending',
            assignedToId: primaryLip.id,
          },
        ],
        invites: [],
      },

      // Case 3: Domestic Abuse Non-Molestation Order
      {
        caseNumber: 'FC-2026-39105',
        title: 'Morgan v Taylor (Non-Molestation Order)',
        court: 'Central Family Court',
        caseType: 'Domestic Abuse (Non-Molestation)',
        status: 'Concluded',
        startedAt: '2025-11-10',
        allocatedJudge: 'DJ Wright',
        currentStage: 'Final Order in Force',
        childrenInvolved: 0,
        seekingPeerSupport: false,
        ownerId: primaryLip.id,
        memberIds: [exampleLip?.id, yopmailLip?.id].filter(Boolean),
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            contactEmail: 'lip@mycasebuddy.co.uk',
            representation: 'Litigant in Person',
            parentalResponsibility: true,
          },
          {
            role: 'Respondent',
            firstName: 'James',
            lastName: 'Taylor',
            address: 'Unknown / Not Disclosed',
            representation: 'Litigant in Person',
          },
        ],
        hearings: [
          {
            type: 'Final',
            date: '2025-12-01',
            time: '11:00',
            location: 'Central Family Court',
            judge: 'DJ Wright',
            notes: 'Contested return hearing for non-molestation and occupation order.',
            outcome: 'Order Made',
            outcomeSummary:
              'Final non-molestation order granted for 12 months with power of arrest attached under section 42A FLA 1996.',
            remotePlatform: 'In-Person',
            specialMeasures: 'Screens, Separate waiting room',
          },
        ],
        orders: [
          {
            type: 'Non-Molestation Order',
            dateMade: '2025-12-01',
            summary:
              'Respondent forbidden from contacting the Applicant directly or indirectly, or coming within 100 metres of Applicant residence. Power of arrest attached.',
            expiresOn: '2026-12-01',
            documentUrl: 'https://example.com/orders/sealed-non-mol-order.pdf',
            hasPenalNotice: true,
            warningNotice:
              'PENAL NOTICE: Under section 42A of the Family Law Act 1996, breach of this order without reasonable excuse is a criminal offence punishable by up to 5 years imprisonment or contempt of court.',
          },
        ],
        documents: [
          {
            title: 'Form FL401 Non-Molestation Application',
            type: 'Application',
            url: 'https://example.com/docs/fl401-application.pdf',
            fileName: 'fl401-application.pdf',
            fileSize: 180000,
            mimeType: 'application/pdf',
            status: 'Filed',
            pageCount: 16,
            exhibitRef: 'FL-1',
          },
          {
            title: 'Sealed Non-Molestation Injunction Order with Power of Arrest',
            type: 'Order',
            url: 'https://example.com/docs/sealed-non-mol-order.pdf',
            fileName: 'sealed-non-mol-order.pdf',
            fileSize: 95000,
            mimeType: 'application/pdf',
            status: 'Served',
            pageCount: 3,
            exhibitRef: 'ORD-1',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            category: 'Hearing Attendance',
            text: 'Contested return hearing before DJ Wright. Injunction granted for 12 months with power of arrest.',
          },
          {
            author: 'Alex Morgan',
            category: 'General Note',
            text: 'Final order sealed by the court and served by process server on 3 Dec 2025. Proof of service lodged with police.',
          },
        ],
        deadlines: [],
        invites: [],
      },

      // Case 4: Financial Remedies FDR
      {
        caseNumber: 'FC-2026-44021',
        title: 'Morgan v Morgan (Financial Dispute Resolution)',
        court: 'East London Family Court',
        caseType: 'Financial Remedies',
        status: 'Open',
        startedAt: '2026-02-20',
        allocatedJudge: 'DJ Sterling',
        currentStage: 'Financial Dispute Resolution (FDR) Appointment',
        childrenInvolved: 2,
        seekingPeerSupport: true,
        peerSupportNote:
          'Looking for tips on preparing the Form E bundle, reviewing questionnaire replies, and dealing with pension sharing queries.',
        peerSupportRequestedAt: now,
        ownerId: primaryLip.id,
        memberIds: [
          exampleLip?.id,
          yopmailLip?.id,
          primaryBarrister?.id,
          exampleBarrister?.id,
          yopmailBarrister1?.id,
        ].filter(Boolean),
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            contactEmail: 'lip@mycasebuddy.co.uk',
            representation: 'Litigant in Person',
            parentalResponsibility: true,
          },
          {
            role: 'Respondent',
            firstName: 'Claire',
            lastName: 'Morgan',
            solicitorFirm: 'Sterling Family Law LLP',
            representation: 'Instructed Solicitor',
            parentalResponsibility: true,
          },
        ],
        hearings: [
          {
            type: 'Directions',
            date: '2026-11-28',
            time: '11:00',
            location: 'East London Family Court, Court 3',
            judge: 'DJ Sterling',
            notes: 'Financial Dispute Resolution appointment. Parties required to make without-prejudice settlement proposals.',
            outcomeSummary: 'FDR hearing listed before DJ Sterling. Core bundles to be lodged 7 days prior.',
            remotePlatform: 'MS Teams',
            remoteLink: 'https://teams.microsoft.com/l/meetup-join/fdr-hearing-44021',
            specialMeasures: 'Separate waiting room',
          },
        ],
        orders: [
          {
            type: 'Financial Remedies Order',
            dateMade: '2026-04-05',
            summary:
              'Directions order for joint single expert on pension CEV and mutual disclosure of 12 months bank statements.',
            expiresOn: '2026-11-28',
            documentUrl: 'https://example.com/orders/fdr-directions-order.pdf',
            hasPenalNotice: false,
          },
        ],
        documents: [
          {
            title: 'Applicant Form E Financial Statement',
            type: 'Statement',
            url: 'https://example.com/docs/applicant-form-e.pdf',
            notes: 'Comprehensive disclosure of capital, liabilities, income, and pensions.',
            fileName: 'applicant-form-e.pdf',
            fileSize: 850000,
            mimeType: 'application/pdf',
            status: 'Filed',
            pageCount: 120,
            exhibitRef: 'FE-1',
          },
          {
            title: 'FDR Core Financial Bundle',
            type: 'Bundle',
            url: 'https://example.com/docs/fdr-bundle.pdf',
            notes: 'Consolidated schedule of assets and chronologies.',
            fileName: 'fdr-bundle.pdf',
            fileSize: 2400000,
            mimeType: 'application/pdf',
            status: 'Draft',
            pageCount: 180,
            exhibitRef: 'BD-FDR',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            category: 'Legal Strategy',
            text: 'Exchanged Form E disclosure with respondent solicitor. Joint pension actuary report received indicating 42% sharing order to equalize retirement income.',
          },
          {
            author: 'Eleanor Rigby KC',
            category: 'Client Conference',
            text: 'Pre-FDR advice conference. Evaluated respondent without-prejudice proposal. Recommended counter-proposal preserving family home equity against pension offset.',
          },
        ],
        deadlines: [
          {
            title: 'Exchange Replies to Questionnaires and Bank Disclosures',
            description: 'Mutual exchange of questionnaire answers and mortgage capacity reports.',
            deadlineDate: '2026-11-15',
            documentType: 'Financial Questionnaire Reply',
            status: 'pending',
            assignedToId: primaryLip.id,
          },
        ],
        invites: [],
      },
    ];

    console.log(`\n🏛️  Seeding ${casesToSeed.length} Family Court cases with full relational hierarchies...\n`);

    for (let cIdx = 0; cIdx < casesToSeed.length; cIdx++) {
      const c = casesToSeed[cIdx];
      const caseDocId = createId();

      // Insert Case
      const caseSql = `
        INSERT INTO cases (
          document_id, case_number, title, court, case_type, status,
          started_at, allocated_judge, current_stage, children_involved,
          seeking_peer_support, peer_support_note, peer_support_requested_at,
          created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16
        ) RETURNING id, case_number, title;
      `;
      const caseRes = await client.query(caseSql, [
        caseDocId,
        c.caseNumber,
        c.title,
        c.court,
        c.caseType,
        c.status,
        c.startedAt,
        c.allocatedJudge,
        c.currentStage,
        c.childrenInvolved,
        c.seekingPeerSupport,
        c.peerSupportNote,
        c.peerSupportRequestedAt,
        now,
        now,
        now,
      ]);
      const caseId = caseRes.rows[0].id;
      console.log(`   [Case ${cIdx + 1}] ${c.caseNumber}: ${c.title}`);

      // Link Owner
      if (c.ownerId) {
        await client.query(
          `INSERT INTO cases_owner_lnk (case_id, user_id) VALUES ($1, $2);`,
          [caseId, c.ownerId]
        );
      }

      // Link Members (deduplicated)
      const uniqueMembers = Array.from(new Set(c.memberIds));
      for (let mOrd = 0; mOrd < uniqueMembers.length; mOrd++) {
        await client.query(
          `INSERT INTO cases_members_lnk (case_id, user_id, user_ord) VALUES ($1, $2, $3);`,
          [caseId, uniqueMembers[mOrd], mOrd + 1]
        );
      }

      // Insert Parties
      for (let pOrd = 0; pOrd < c.parties.length; pOrd++) {
        const p = c.parties[pOrd];
        const partyDocId = createId();
        const pSql = `
          INSERT INTO parties (
            document_id, role, first_name, last_name, date_of_birth, address,
            solicitor_firm, solicitor_contact, contact_email, contact_phone,
            representation, parental_responsibility, school_or_nursery, special_measures_required,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id;
        `;
        const pRes = await client.query(pSql, [
          partyDocId,
          p.role,
          p.firstName,
          p.lastName,
          p.dateOfBirth || null,
          p.address || null,
          p.solicitorFirm || null,
          p.solicitorContact || null,
          p.contactEmail || null,
          p.contactPhone || null,
          p.representation || null,
          typeof p.parentalResponsibility === 'boolean' ? p.parentalResponsibility : null,
          p.schoolOrNursery || null,
          p.specialMeasuresRequired || null,
          now,
          now,
          now,
        ]);
        const partyId = pRes.rows[0].id;
        await client.query(
          `INSERT INTO parties_case_lnk (party_id, case_id, party_ord) VALUES ($1, $2, $3);`,
          [partyId, caseId, pOrd + 1]
        );
      }
      console.log(`      ✓ ${c.parties.length} Parties seeded (with representation, PR, schooling)`);

      // Insert Hearings
      for (let hOrd = 0; hOrd < c.hearings.length; hOrd++) {
        const h = c.hearings[hOrd];
        const hDocId = createId();
        const hSql = `
          INSERT INTO hearings (
            document_id, type, date, time, location, judge, notes, outcome, outcome_summary,
            remote_platform, remote_link, special_measures,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id;
        `;
        const hRes = await client.query(hSql, [
          hDocId,
          h.type,
          h.date,
          h.time || null,
          h.location || null,
          h.judge || null,
          h.notes || null,
          h.outcome || null,
          h.outcomeSummary || null,
          h.remotePlatform || null,
          h.remoteLink || null,
          h.specialMeasures || null,
          now,
          now,
          now,
        ]);
        const hearingId = hRes.rows[0].id;
        await client.query(
          `INSERT INTO hearings_case_lnk (hearing_id, case_id, hearing_ord) VALUES ($1, $2, $3);`,
          [hearingId, caseId, hOrd + 1]
        );
      }
      console.log(`      ✓ ${c.hearings.length} Hearings seeded (with remote platform, CVP links)`);

      // Insert Orders
      for (let oOrd = 0; oOrd < c.orders.length; oOrd++) {
        const o = c.orders[oOrd];
        const oDocId = createId();
        const oSql = `
          INSERT INTO orders (
            document_id, type, date_made, summary, expires_on, document_url,
            has_penal_notice, warning_notice, compliance_deadlines,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id;
        `;
        const oRes = await client.query(oSql, [
          oDocId,
          o.type,
          o.dateMade,
          o.summary,
          o.expiresOn || null,
          o.documentUrl || null,
          Boolean(o.hasPenalNotice),
          o.warningNotice || null,
          o.complianceDeadlines || null,
          now,
          now,
          now,
        ]);
        const orderId = oRes.rows[0].id;
        await client.query(
          `INSERT INTO orders_case_lnk (order_id, case_id, order_ord) VALUES ($1, $2, $3);`,
          [orderId, caseId, oOrd + 1]
        );
      }
      console.log(`      ✓ ${c.orders.length} Court Orders seeded (with penal notice & compliance directions)`);

      // Insert Documents
      for (let dOrd = 0; dOrd < c.documents.length; dOrd++) {
        const d = c.documents[dOrd];
        const dDocId = createId();
        const dSql = `
          INSERT INTO documents (
            document_id, title, type, uploaded_at, url, notes,
            file_name, file_size, mime_type, status, page_count, exhibit_ref,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id;
        `;
        const dRes = await client.query(dSql, [
          dDocId,
          d.title,
          d.type,
          now,
          d.url,
          d.notes || null,
          d.fileName || null,
          d.fileSize || null,
          d.mimeType || 'application/pdf',
          d.status || 'Filed',
          d.pageCount || null,
          d.exhibitRef || null,
          now,
          now,
          now,
        ]);
        const documentId = dRes.rows[0].id;
        await client.query(
          `INSERT INTO documents_case_lnk (document_id, case_id, document_ord) VALUES ($1, $2, $3);`,
          [documentId, caseId, dOrd + 1]
        );
      }
      console.log(`      ✓ ${c.documents.length} Documents seeded (with page counts, exhibits, filing status)`);

      // Insert Notes
      for (let nOrd = 0; nOrd < c.notes.length; nOrd++) {
        const n = c.notes[nOrd];
        const nDocId = createId();
        const nSql = `
          INSERT INTO case_notes (
            document_id, author, text, category,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `;
        const nRes = await client.query(nSql, [
          nDocId,
          n.author,
          n.text,
          n.category || 'General Note',
          now,
          now,
          now,
        ]);
        const noteId = nRes.rows[0].id;
        await client.query(
          `INSERT INTO case_notes_case_lnk (case_note_id, case_id, case_note_ord) VALUES ($1, $2, $3);`,
          [noteId, caseId, nOrd + 1]
        );
      }
      console.log(`      ✓ ${c.notes.length} Case Notes seeded (with legal categories)`);

      // Insert Deadlines
      for (let dlOrd = 0; dlOrd < c.deadlines.length; dlOrd++) {
        const dl = c.deadlines[dlOrd];
        const dlDocId = createId();
        const dlSql = `
          INSERT INTO document_deadlines (
            document_id, title, description, deadline_date, document_type, status, submitted_at,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id;
        `;
        const dlRes = await client.query(dlSql, [
          dlDocId,
          dl.title,
          dl.description || null,
          dl.deadlineDate,
          dl.documentType || null,
          dl.status || 'pending',
          dl.submittedAt || null,
          now,
          now,
          now,
        ]);
        const deadlineId = dlRes.rows[0].id;
        await client.query(
          `INSERT INTO document_deadlines_case_lnk (document_deadline_id, case_id, document_deadline_ord) VALUES ($1, $2, $3);`,
          [deadlineId, caseId, dlOrd + 1]
        );

        if (dl.assignedToId) {
          await client.query(
            `INSERT INTO document_deadlines_assigned_to_lnk (document_deadline_id, user_id) VALUES ($1, $2);`,
            [deadlineId, dl.assignedToId]
          );
        }
      }
      console.log(`      ✓ ${c.deadlines.length} Document Deadlines seeded`);

      // Insert Invites
      for (let iOrd = 0; iOrd < c.invites.length; iOrd++) {
        const inv = c.invites[iOrd];
        const invDocId = createId();
        const invSql = `
          INSERT INTO case_invites (
            document_id, token, role, expires_at,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `;
        const invRes = await client.query(invSql, [
          invDocId,
          inv.token,
          inv.role,
          inv.expiresAt || null,
          now,
          now,
          now,
        ]);
        const inviteId = invRes.rows[0].id;
        await client.query(
          `INSERT INTO case_invites_case_lnk (case_invite_id, case_id, case_invite_ord) VALUES ($1, $2, $3);`,
          [inviteId, caseId, iOrd + 1]
        );
      }
      if (c.invites.length > 0) {
        console.log(`      ✓ ${c.invites.length} Case Invites seeded`);
      }
    }

    // 5. Seed Guidance Roadmap Data
    console.log('\n📖 Seeding UK Family Court Guidance Roadmap Data...');
    await seedGuidance(client);

    console.log('\n============================================================');
    console.log('🎉 My Case Buddy Database Seeding Complete & Fully Verified!');
    console.log('============================================================\n');
    console.log('Ready to test login! Use the following credentials (all Password: Password123!):');
    console.log('┌──────────────────┬─────────────────────────────┬──────────────────────────┐');
    console.log('│ Role             │ Primary Account             │ Compatible Aliases       │');
    console.log('├──────────────────┼─────────────────────────────┼──────────────────────────┤');
    console.log('│ Litigant Person  │ lip@mycasebuddy.co.uk       │ lip@example.com          │');
    console.log('│                  │                             │ lip1@yopmail.com         │');
    console.log('│ McKenzie Friend  │ mckenzie@mycasebuddy.co.uk  │ mckenzie@example.com     │');
    console.log('│                  │                             │ mackenzi1@yopmail.com    │');
    console.log('│                  │                             │ mackenzi2@yopmail.com    │');
    console.log('│ Family Solicitor │ solicitor@mycasebuddy.co.uk │ solicitor@example.com    │');
    console.log('│ Family Barrister │ barrister@mycasebuddy.co.uk │ barrister@example.com    │');
    console.log('│                  │                             │ barister1@yopmail.com    │');
    console.log('└──────────────────┴─────────────────────────────┴──────────────────────────┘\n');
  } catch (err) {
    console.error('❌ Database seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

seedDatabase();
