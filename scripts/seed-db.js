/**
 * seed-db.js
 *
 * Seeds comprehensive, realistic UK Family Court test data into Strapi PostgreSQL (Neon).
 * Generates verified user accounts for all roles (LIP, McKenzie Friend, Solicitor, Barrister)
 * with known credentials for local authentication (/api/auth/local).
 *
 * Usage:
 *   node scripts/seed-db.js
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { createId } = require('@paralleldrive/cuid2');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

const DEFAULT_PASSWORD = 'Password123!';

async function seedDatabase() {
  console.log('🌱 Starting My Case Buddy Database Seeding...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL (Neon).');

    // 1. Get Authenticated Role
    const roleRes = await client.query(
      `SELECT id FROM up_roles WHERE type = 'authenticated' LIMIT 1;`
    );
    if (roleRes.rows.length === 0) {
      throw new Error("Could not find 'authenticated' role in up_roles.");
    }
    const authenticatedRoleId = roleRes.rows[0].id;
    console.log(`🔑 Authenticated Role ID: ${authenticatedRoleId}`);

    // Pre-compute bcrypt password hash
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const now = new Date();

    // 2. Define Users
    const usersToSeed = [
      {
        username: 'lip_user',
        email: 'lip@example.com',
        name: 'Alex Morgan',
        userRole: 'LIP',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        bio: 'Litigant in Person navigating child arrangements and family court proceedings.',
        confirmed: true,
        blocked: false,
      },
      {
        username: 'sarah_mckenzie',
        email: 'mckenzie@example.com',
        name: 'Sarah Jenkins',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Experienced McKenzie Friend with 6+ years supporting litigants in person through Child Arrangements disputes, position statement drafting, and court hearings.',
        yearsExperience: 6,
        specialisms: JSON.stringify(['Child Arrangements', 'Fact-Finding Hearings', 'FHDRA & DRA']),
        confirmed: true,
        blocked: false,
      },
      {
        username: 'kevin_mckenzie',
        email: 'kevin.mckenzie@example.com',
        name: 'Kevin Moore',
        userRole: 'McKenzieFriend',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Specialist McKenzie Friend offering procedural advice and emotional support for family court proceedings.',
        yearsExperience: 4,
        specialisms: JSON.stringify(['Domestic Abuse', 'Child Arrangements']),
        confirmed: true,
        blocked: false,
      },
      {
        username: 'david_solicitor',
        email: 'solicitor@example.com',
        name: 'David Vance',
        userRole: 'Solicitor',
        firm: 'Vance & Partners Family Law LLP',
        registrationNumber: 'SRA-682910',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Senior Family Law Solicitor specializing in complex child arrangements and financial remedies.',
        yearsExperience: 14,
        specialisms: JSON.stringify(['Care Proceedings', 'Financial Remedies', 'Private Law']),
        confirmed: true,
        blocked: false,
      },
      {
        username: 'hannah_solicitor',
        email: 'hannah.solicitor@example.com',
        name: 'Hannah Brown',
        userRole: 'Solicitor',
        firm: 'Brown & Co Solicitors',
        registrationNumber: 'SRA-741209',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Solicitor focusing on emergency non-molestation orders and child protection matters.',
        yearsExperience: 9,
        specialisms: JSON.stringify(['Non-Molestation Orders', 'Child Protection']),
        confirmed: true,
        blocked: false,
      },
      {
        username: 'eleanor_barrister',
        email: 'barrister@example.com',
        name: 'Eleanor Rigby KC',
        userRole: 'Barrister',
        firm: 'Apex Family Chambers, London',
        registrationNumber: 'BSB-49201',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: "King's Counsel specializing in High Court family division appeals, contested care orders, and multi-day fact-finding hearings.",
        yearsExperience: 20,
        specialisms: JSON.stringify(['High Court Family Division', 'Appeals', 'Complex Fact-Finding']),
        confirmed: true,
        blocked: false,
      },
      {
        username: 'oliver_barrister',
        email: 'oliver.barrister@example.com',
        name: 'Oliver Anderson',
        userRole: 'Barrister',
        firm: 'Temple Gate Chambers',
        registrationNumber: 'BSB-55312',
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        bio: 'Family law barrister with substantial advocacy experience in financial remedies and dispute resolution.',
        yearsExperience: 11,
        specialisms: JSON.stringify(['Financial Remedies', 'Child Arrangements']),
        confirmed: true,
        blocked: false,
      },
    ];

    console.log(`👥 Seeding ${usersToSeed.length} user accounts (Password: ${DEFAULT_PASSWORD})...`);
    const seededUsers = {};

    for (const u of usersToSeed) {
      const docId = createId();
      const insertUserSql = `
        INSERT INTO up_users (
          document_id, username, email, password, provider, confirmed, blocked,
          name, user_role, subscription_tier, subscription_status, firm,
          registration_number, bio, specialisms, years_experience,
          created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19
        ) RETURNING id, document_id, username, email, user_role;
      `;
      const res = await client.query(insertUserSql, [
        docId,
        u.username,
        u.email,
        hashedPassword,
        'local',
        u.confirmed,
        u.blocked,
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

      const user = res.rows[0];
      seededUsers[u.username] = user;

      // Link to authenticated role
      await client.query(
        `INSERT INTO up_users_role_lnk (user_id, role_id, user_ord) VALUES ($1, $2, 1);`,
        [user.id, authenticatedRoleId]
      );

      console.log(`   ✓ ${user.user_role.padEnd(14)} | ${user.email} (${user.username})`);
    }

    const lipUser = seededUsers['lip_user'];
    const mckenzieUser = seededUsers['sarah_mckenzie'];
    const solicitorUser = seededUsers['david_solicitor'];

    // 3. Define Cases with Nested Relations
    const casesToSeed = [
      {
        caseNumber: 'FC-2026-10492',
        title: 'In the matter of Leo & Maya Morgan (Child Arrangements)',
        court: 'Family Court',
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
        ownerId: lipUser.id,
        memberIds: [mckenzieUser.id],
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            dateOfBirth: '1988-06-12',
            address: '14 St. Jude Street, Islington, London N1 2PL',
            contactEmail: 'lip@example.com',
            contactPhone: '+44 7700 900123',
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
          },
          {
            role: 'Child',
            firstName: 'Leo',
            lastName: 'Morgan',
            dateOfBirth: '2018-04-10',
          },
          {
            role: 'Child',
            firstName: 'Maya',
            lastName: 'Morgan',
            dateOfBirth: '2021-08-15',
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
          },
          {
            type: 'Directions',
            date: '2026-12-18',
            time: '14:00',
            location: 'Central Family Court, First Avenue House, Courtroom 2',
            judge: 'DJ Patel',
            notes: 'Dispute Resolution Appointment (DRA). Review Cafcass Section 7 report and testing of weekend contact arrangements.',
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
          },
        ],
        documents: [
          {
            title: 'Form C100 Child Arrangements Application',
            type: 'Application',
            url: 'https://example.com/docs/c100-application.pdf',
            notes: 'Original sealed application submitted to Central Family Court on 15 Jan 2026.',
          },
          {
            title: 'Applicant First Position Statement for FHDRA',
            type: 'Statement',
            url: 'https://example.com/docs/applicant-position-statement-1.pdf',
            notes: 'Drafted with McKenzie Friend support outlining current care schedule and proposed holiday sharing.',
          },
          {
            title: 'Cafcass Schedule 2 Safeguarding Enquiries Letter',
            type: 'Expert Report',
            url: 'https://example.com/docs/cafcass-schedule2.pdf',
            notes: 'Police and local authority screening complete with no safeguarding markers identified.',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            text: 'Submitted Form C100 application to the court and received case number FC-2026-10492.',
          },
          {
            author: 'Sarah Jenkins',
            text: 'Reviewed initial Cafcass letter. Safeguarding checks are clear. Recommended focusing position statement on practical school routines.',
          },
          {
            author: 'Alex Morgan',
            text: 'Filed draft position statement with court administration and served copy to respondent solicitor.',
          },
        ],
        deadlines: [
          {
            title: 'File and Serve Position Statement for FHDRA',
            description: 'Provide 2-page position statement to the court and respondent at least 3 business days before hearing.',
            deadlineDate: '2026-11-05',
            documentType: 'Position Statement',
            status: 'pending',
            assignedToId: lipUser.id,
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
            assignedToId: lipUser.id,
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
      {
        caseNumber: 'FC-2026-28194',
        title: 'London Borough of Camden v Davies (Care Proceedings s.31)',
        court: 'Family Court',
        caseType: 'Public Law (Care Proceedings)',
        status: 'Open',
        startedAt: '2026-03-01',
        allocatedJudge: 'HHJ Campbell',
        currentStage: 'Issues Resolution Hearing (IRH)',
        childrenInvolved: 1,
        seekingPeerSupport: false,
        ownerId: lipUser.id,
        memberIds: [solicitorUser.id],
        parties: [
          {
            role: 'Applicant',
            firstName: 'London Borough of Camden',
            lastName: 'Children Services',
            solicitorFirm: 'Camden Legal Services',
            solicitorContact: 'Robert Hughes (+44 20 7974 4444)',
            contactEmail: 'legal.children@camden.gov.uk',
          },
          {
            role: 'Respondent',
            firstName: 'Alex',
            lastName: 'Morgan',
            dateOfBirth: '1988-06-12',
            contactEmail: 'lip@example.com',
          },
          {
            role: 'Child',
            firstName: 'Ethan',
            lastName: 'Davies',
            dateOfBirth: '2022-02-14',
          },
          {
            role: 'Guardian',
            firstName: 'Sarah',
            lastName: 'Palmer',
            solicitorFirm: 'Cafcass Legal',
            contactEmail: 'sarah.palmer@cafcass.gov.uk',
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
          },
        ],
        orders: [
          {
            type: 'Supervision Order',
            dateMade: '2026-03-15',
            summary: 'Interim supervision order granted to local authority pending independent parenting assessment.',
            expiresOn: '2026-11-30',
            documentUrl: 'https://example.com/orders/interim-supervision-order.pdf',
          },
        ],
        documents: [
          {
            title: 'Local Authority Section 31 Care Application & Threshold Document',
            type: 'Application',
            url: 'https://example.com/docs/s31-care-application.pdf',
            notes: 'Contains formal threshold criteria alleged under s.31(2) Children Act 1989.',
          },
          {
            title: 'Independent Social Work Parenting Assessment',
            type: 'Expert Report',
            url: 'https://example.com/docs/parenting-assessment.pdf',
            notes: 'Comprehensive positive assessment recommending transition back to parental care.',
          },
        ],
        notes: [
          {
            author: 'David Vance',
            text: 'Reviewed independent social work assessment. Finding is highly supportive of our position. Preparing response to threshold criteria.',
          },
        ],
        deadlines: [
          {
            title: 'Submit Response to Final Social Work Evidence',
            description: 'Respondent skeleton argument and witness statement in response to Camden care plan.',
            deadlineDate: '2026-11-10',
            documentType: 'Threshold Response',
            status: 'pending',
            assignedToId: lipUser.id,
          },
        ],
        invites: [],
      },
      {
        caseNumber: 'FC-2026-39105',
        title: 'Morgan v Taylor (Non-Molestation Order)',
        court: 'Family Court',
        caseType: 'Domestic Abuse (Non-Molestation)',
        status: 'Concluded',
        startedAt: '2025-11-10',
        allocatedJudge: 'DJ Wright',
        currentStage: 'Final Injunction Order in Force',
        childrenInvolved: 0,
        seekingPeerSupport: false,
        ownerId: lipUser.id,
        memberIds: [],
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            contactEmail: 'lip@example.com',
          },
          {
            role: 'Respondent',
            firstName: 'James',
            lastName: 'Taylor',
            address: 'Unknown / Not Disclosed',
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
            outcome: 'Final non-molestation order granted for 12 months with power of arrest attached.',
          },
        ],
        orders: [
          {
            type: 'Non-Molestation Order',
            dateMade: '2025-12-01',
            summary:
              'Respondent forbidden from contacting the Applicant directly or indirectly, or coming within 100 meters of Applicant residence. Power of arrest attached.',
            expiresOn: '2026-12-01',
            documentUrl: 'https://example.com/orders/sealed-non-mol-order.pdf',
          },
        ],
        documents: [
          {
            title: 'Form FL401 Non-Molestation Application',
            type: 'Application',
            url: 'https://example.com/docs/fl401-application.pdf',
          },
          {
            title: 'Sealed Non-Molestation Injunction Order with Power of Arrest',
            type: 'Order',
            url: 'https://example.com/docs/sealed-non-mol-order.pdf',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            text: 'Final order sealed by the court and served by process server on 3 Dec 2025.',
          },
        ],
        deadlines: [],
        invites: [],
      },
      {
        caseNumber: 'FC-2026-44021',
        title: 'Morgan v Morgan (Financial Dispute Resolution)',
        court: 'Family Court',
        caseType: 'Financial Remedies',
        status: 'Open',
        startedAt: '2026-02-20',
        allocatedJudge: 'DJ Sterling',
        currentStage: 'Financial Dispute Resolution (FDR) Appointment',
        childrenInvolved: 2,
        seekingPeerSupport: true,
        peerSupportNote:
          'Looking for tips on preparing the Form E bundle and dealing with pension sharing queries.',
        peerSupportRequestedAt: now,
        ownerId: lipUser.id,
        memberIds: [],
        parties: [
          {
            role: 'Applicant',
            firstName: 'Alex',
            lastName: 'Morgan',
            contactEmail: 'lip@example.com',
          },
          {
            role: 'Respondent',
            firstName: 'Claire',
            lastName: 'Morgan',
            solicitorFirm: 'Sterling Family Law LLP',
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
          },
        ],
        orders: [
          {
            type: 'Financial Remedies Order',
            dateMade: '2026-04-05',
            summary: 'Directions order for joint single expert on pension CEV and mutual disclosure of 12 months bank statements.',
            expiresOn: '2026-11-28',
            documentUrl: 'https://example.com/orders/fdr-directions-order.pdf',
          },
        ],
        documents: [
          {
            title: 'Applicant Form E Financial Statement',
            type: 'Statement',
            url: 'https://example.com/docs/applicant-form-e.pdf',
            notes: 'Comprehensive disclosure of capital, liabilities, income, and pensions.',
          },
          {
            title: 'FDR Core Financial Bundle',
            type: 'Bundle',
            url: 'https://example.com/docs/fdr-bundle.pdf',
            notes: 'Consolidated schedule of assets and chronologies.',
          },
        ],
        notes: [
          {
            author: 'Alex Morgan',
            text: 'Exchanged Form E disclosure with respondent solicitor. Joint pension report received.',
          },
        ],
        deadlines: [
          {
            title: 'Exchange Replies to Questionnaires and Bank Disclosures',
            description: 'Mutual exchange of questionnaire answers and mortgage capacity reports.',
            deadlineDate: '2026-11-15',
            documentType: 'Financial Questionnaire Reply',
            status: 'pending',
            assignedToId: lipUser.id,
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

      // Link Members
      for (let mOrd = 0; mOrd < c.memberIds.length; mOrd++) {
        await client.query(
          `INSERT INTO cases_members_lnk (case_id, user_id, user_ord) VALUES ($1, $2, $3);`,
          [caseId, c.memberIds[mOrd], mOrd + 1]
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
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      console.log(`      ✓ ${c.parties.length} Parties seeded`);

      // Insert Hearings
      for (let hOrd = 0; hOrd < c.hearings.length; hOrd++) {
        const h = c.hearings[hOrd];
        const hDocId = createId();
        const hSql = `
          INSERT INTO hearings (
            document_id, type, date, time, location, judge, notes, outcome,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      console.log(`      ✓ ${c.hearings.length} Hearings seeded`);

      // Insert Orders
      for (let oOrd = 0; oOrd < c.orders.length; oOrd++) {
        const o = c.orders[oOrd];
        const oDocId = createId();
        const oSql = `
          INSERT INTO orders (
            document_id, type, date_made, summary, expires_on, document_url,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id;
        `;
        const oRes = await client.query(oSql, [
          oDocId,
          o.type,
          o.dateMade,
          o.summary,
          o.expiresOn || null,
          o.documentUrl || null,
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
      console.log(`      ✓ ${c.orders.length} Court Orders seeded`);

      // Insert Documents
      for (let dOrd = 0; dOrd < c.documents.length; dOrd++) {
        const d = c.documents[dOrd];
        const dDocId = createId();
        const dSql = `
          INSERT INTO documents (
            document_id, title, type, uploaded_at, url, notes,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id;
        `;
        const dRes = await client.query(dSql, [
          dDocId,
          d.title,
          d.type,
          now,
          d.url,
          d.notes || null,
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
      console.log(`      ✓ ${c.documents.length} Case Documents seeded`);

      // Insert Notes
      for (let nOrd = 0; nOrd < c.notes.length; nOrd++) {
        const n = c.notes[nOrd];
        const nDocId = createId();
        const nSql = `
          INSERT INTO case_notes (
            document_id, author, text,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id;
        `;
        const nRes = await client.query(nSql, [
          nDocId,
          n.author,
          n.text,
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
      console.log(`      ✓ ${c.notes.length} Case Notes seeded`);

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
            document_id, token, role, expires_at, created_by_id,
            created_at, updated_at, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id;
        `;
        const invRes = await client.query(invSql, [
          invDocId,
          inv.token,
          inv.role,
          inv.expiresAt || null,
          lipUser.id,
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

    console.log('\n============================================================');
    console.log('🎉 My Case Buddy Database Seeding Complete!');
    console.log('============================================================\n');
    console.log('Ready to test login! Use the following credentials:');
    console.log('┌──────────────────┬─────────────────────────────┬──────────────┐');
    console.log('│ Role             │ Email                       │ Password     │');
    console.log('├──────────────────┼─────────────────────────────┼──────────────┤');
    console.log('│ LIP (Applicant)  │ lip@example.com             │ Password123! │');
    console.log('│ McKenzie Friend  │ mckenzie@example.com        │ Password123! │');
    console.log('│ Solicitor        │ solicitor@example.com       │ Password123! │');
    console.log('│ Barrister        │ barrister@example.com       │ Password123! │');
    console.log('└──────────────────┴─────────────────────────────┴──────────────┘\n');
  } catch (err) {
    console.error('❌ Database seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

seedDatabase();
