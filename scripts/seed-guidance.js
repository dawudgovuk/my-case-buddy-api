/**
 * seed-guidance.js
 *
 * Seeds comprehensive UK Family Court guidance roadmap data into Strapi PostgreSQL (Neon).
 * Populates Maps, Journeys, Steps, Articles, References, and relational links.
 *
 * Usage:
 *   node scripts/seed-guidance.js
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const connectionString = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '').replace('-pooler.', '.');

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

function generateDocId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';
  for (let i = 0; i < 24; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

async function seedGuidance(externalClient) {
  console.log('🌱 Starting UK Family Court Guidance Database Seeding...\n');

  const shouldClose = !externalClient;
  const client = externalClient || new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    if (!externalClient) {
      await client.connect();
      console.log('🔌 Connected to PostgreSQL (Neon).');
    }

    // 1. References
    console.log('📄 Seeding Guidance References...');
    const references = [
      {
        name: 'Form C100: Child Arrangements Application',
        slug: 'form-c100',
        url: 'https://assets.publishing.service.gov.uk/media/649987f2103e67000c14c552/c100-eng.pdf',
        type: 'Form',
        keywords: 'c100, application, child arrangements, custody, court form',
      },
      {
        name: 'Form C1A: Allegations of Harm & Domestic Abuse',
        slug: 'form-c1a',
        url: 'https://assets.publishing.service.gov.uk/media/624ea8558fa8f52778e34898/c1a-eng.pdf',
        type: 'Form',
        keywords: 'c1a, harm, domestic violence, abuse, safeguarding',
      },
      {
        name: 'Form C4: Order for Disclosure of Child Whereabouts',
        slug: 'form-c4',
        url: 'https://assets.publishing.service.gov.uk/media/5bc74f9ced915d0acfa339e0/c4-eng.pdf',
        type: 'Form',
        keywords: 'c4, whereabouts, abduction, location, disclosure',
      },
      {
        name: 'Form C2: Application in Existing Proceedings',
        slug: 'form-c2',
        url: 'https://assets.publishing.service.gov.uk/media/5fa12497e90e070420b92557/c2-eng.pdf',
        type: 'Form',
        keywords: 'c2, directions, urgent hearing, interim order',
      },
      {
        name: 'Form C79: Enforcement of Child Arrangements Order',
        slug: 'form-c79',
        url: 'https://assets.publishing.service.gov.uk/media/5e173cbfe5274a441e97d197/c79-eng.pdf',
        type: 'Form',
        keywords: 'c79, enforcement, breach of order, contact denied',
      },
      {
        name: 'Form EX160: Apply for Help with Court Fees',
        slug: 'form-ex160',
        url: 'https://assets.publishing.service.gov.uk/media/62a9d821e90e07038cf56be0/ex160-eng.pdf',
        type: 'Form',
        keywords: 'ex160, fees, fee remission, financial help',
      },
      {
        name: 'HMCTS Court & Tribunal Finder',
        slug: 'hmcts-court-finder',
        url: 'https://www.find-court-tribunal.service.gov.uk/',
        type: 'Web',
        keywords: 'court finder, hmcts, local family court, hearing venue',
      },
      {
        name: 'Cafcass Statutory Welfare Checklist',
        slug: 'cafcass-welfare-checklist',
        url: 'https://www.cafcass.gov.uk/grown-ups/parents-and-carers/divorce-and-separation/welfare-checklist/',
        type: 'Document',
        keywords: 'welfare checklist, cafcass, children act 1989, section 1',
      },
    ];

    const refMap = {};
    for (const r of references) {
      const existing = await client.query('SELECT id FROM guidance_references WHERE slug = $1', [r.slug]);
      if (existing.rows.length > 0) {
        refMap[r.slug] = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO guidance_references (document_id, name, slug, url, type, keywords)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [generateDocId(), r.name, r.slug, r.url, r.type, r.keywords]
        );
        refMap[r.slug] = res.rows[0].id;
      }
    }
    console.log(`  ✔ Seeded ${Object.keys(refMap).length} references.`);

    // 2. Articles
    console.log('📖 Seeding Guidance Articles...');
    const articles = [
      {
        title: 'Step-by-Step Guide: How to Fill in Form C100',
        slug: 'guide-how-to-fill-in-form-c100',
        content: `### Overview of Form C100
Form C100 is the standard application form used in England & Wales to request a Child Arrangements Order from the Family Court.

#### Section-by-Section Instructions:
- **Section 1: The Children**: List every child subject to this application, their full legal names, dates of birth, and who they currently live with.
- **Section 2: The Orders Applied For**: Choose between "Child Arrangements Order" (deciding who the child lives with or spends time with), "Specific Issue Order" (e.g. schooling, medical consent), or "Prohibited Steps Order" (preventing removal from the country).
- **Section 3: Mediation Information & Assessment Meeting (MIAM)**: Unless you have a valid statutory exemption (e.g. domestic violence evidence), an authorised mediator must sign Section 14 before the court will accept your application.
- **Section 7: Risk of Harm**: If you suspect harm, domestic abuse, or neglect, you must tick "Yes" and complete supplemental Form C1A.
- **Section 13: Statement of Truth**: Sign and date honestly under penalty of contempt of court.`,
        keywords: 'c100, application, how to fill, children act, guidance',
        category: 'Applications',
        refs: ['form-c100', 'form-ex160', 'hmcts-court-finder'],
      },
      {
        title: 'Form C1A Guide: Declaring Domestic Abuse & Welfare Concerns',
        slug: 'guide-form-c1a-allegations-of-harm',
        content: `### When is Form C1A Required?
Form C1A must be submitted whenever allegations of domestic abuse, violence, emotional harm, sexual abuse, or child safety concerns are raised.

#### Key Tips for Litigants in Person:
1. **Focus on Direct Impact**: Explain how each alleged behavior directly affected the children's wellbeing.
2. **Be Chronological and Factual**: State dates, police CAD numbers, and whether medical attention was sought.
3. **Avoid Unsubstantiated Slurs**: Stick to verifiable facts and contemporaneous records.`,
        keywords: 'c1a, domestic abuse, child protection, safety, non-molestation',
        category: 'Evidence',
        refs: ['form-c1a', 'cafcass-welfare-checklist'],
      },
      {
        title: 'How to Serve Court Documents & Find Your Local Family Court',
        slug: 'guide-serving-sealed-court-documents',
        content: `### What Does "Serving" Mean?
After submitting your application to the court, the court office will stamp it with a seal and issue a Case Number. You must deliver a copy of the sealed paperwork to the Respondent.

#### Rules for Service (FPR Part 6):
- **Notice of Hearing**: Must be served at least 14 days before the First Hearing (FHDRA).
- **Hand Delivery vs First Class Post**: Serving by 1st class post to their last known residence is standard. Keep a certificate of postage.
- **Form C9 / Certificate of Service**: File a Form C9 with the court confirming on what date and by what method service took place.`,
        keywords: 'service, serve documents, court finder, seal, fpr part 6',
        category: 'Procedure',
        refs: ['form-c100', 'hmcts-court-finder'],
      },
      {
        title: 'Preparing for Your Cafcass Telephone Interview & Safeguarding Checks',
        slug: 'guide-cafcass-interview-preparation',
        content: `### What is Cafcass?
Cafcass stands for the Children and Family Court Advisory and Support Service. They are independent of the court and social services.

#### The Safeguarding Interview:
- A Cafcass Family Court Adviser will conduct a 30–45 minute telephone interview with each parent before the first hearing.
- **Focus 100% on the Children**: Talk about your child’s routine, hobbies, emotional needs, and how you support their relationship with both parents.
- **Safeguarding Letter**: Cafcass compiles checks from the Police National Computer and local Social Services into a letter advising the judge whether contact is safe to order.`,
        keywords: 'cafcass, safeguarding letter, interview prep, telephone check',
        category: 'Hearings',
        refs: ['cafcass-welfare-checklist'],
      },
      {
        title: 'How to Prepare a Court-Compliant Scott Schedule of Allegations',
        slug: 'guide-drafting-scott-schedule',
        content: `### What is a Scott Schedule?
A Scott Schedule is a 6-column legal table ordered by the judge when serious allegations are in dispute.

#### Standard Columns:
1. **Item #**: Consecutive number (typically restricted to the top 4–6 most serious incidents).
2. **Date & Location**: Specific dates and places where the incident took place.
3. **Allegation**: Concise factual narrative of what occurred.
4. **Evidence Reference**: Exact page number in the bundle (e.g., Police report CAD-1234 p. 45).
5. **Respondent’s Reply**: Admitted, Denied, or contextual explanation.
6. **Judge’s Finding**: Left completely blank for the judge’s ruling.`,
        keywords: 'scott schedule, fact finding, allegations, evidence, cross-examination',
        category: 'Evidence',
        refs: ['form-c1a'],
      },
      {
        title: 'Drafting an Effective Position Statement for the Judge',
        slug: 'guide-drafting-position-statement',
        content: `### Purpose of a Position Statement
A Position Statement is a 2 to 3-page document handed to the judge, Cafcass officer, and other party at the start of each hearing.

#### Recommended Structure:
- **Header**: Court Name, Case Number, Names of Parties, Date of Hearing.
- **Background**: Brief 2-sentence summary of proceedings so far.
- **Current Position**: What the day-to-day contact is right now.
- **What You Seek Today**: Specific draft directions or orders requested.
- **Alignment with the Welfare Checklist**: Why this order serves the child's best interests.`,
        keywords: 'position statement, hearing prep, trial bundle, welfare checklist',
        category: 'Hearings',
        refs: ['cafcass-welfare-checklist'],
      },
    ];

    const artMap = {};
    for (const a of articles) {
      let artId;
      const existing = await client.query('SELECT id FROM guidance_articles WHERE slug = $1', [a.slug]);
      if (existing.rows.length > 0) {
        artId = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO guidance_articles (document_id, title, slug, content, keywords, category)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [generateDocId(), a.title, a.slug, a.content, a.keywords, a.category]
        );
        artId = res.rows[0].id;
      }
      artMap[a.slug] = artId;

      // Link article to references
      for (let ord = 0; ord < a.refs.length; ord++) {
        const rSlug = a.refs[ord];
        const rId = refMap[rSlug];
        if (rId) {
          await client.query(
            `INSERT INTO guidance_articles_references_lnk (guidance_article_id, guidance_reference_id, guidance_reference_ord)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [artId, rId, ord + 1]
          );
        }
      }
    }
    console.log(`  ✔ Seeded ${Object.keys(artMap).length} guidance articles.`);

    // 3. Steps
    console.log('🚶 Seeding Guidance Steps...');
    const steps = [
      {
        name: 'Attend MIAM or Claim Statutory Exemption',
        slug: 'step-attend-miam',
        description: 'Under FPR Rule 3.8, you must attend an authorized mediation session or obtain an exemption signature.',
        order: 1,
        isConditional: false,
        category: 'Mediation',
        articles: ['guide-how-to-fill-in-form-c100'],
      },
      {
        name: 'Apply for Help with Fees (Form EX160)',
        slug: 'step-help-with-fees',
        description: 'If you receive qualifying benefits or have low income, obtain an HWF reference number to waive the £255 fee.',
        order: 2,
        isConditional: true,
        conditionCriteria: 'Only required if applying for fee remission based on income or state benefits.',
        category: 'Fees',
        articles: ['guide-how-to-fill-in-form-c100'],
      },
      {
        name: 'Complete Application Form C100',
        slug: 'step-complete-c100',
        description: 'Fill in all 14 sections of Form C100 outlining child arrangements and reasons for application.',
        order: 3,
        isConditional: false,
        category: 'Application',
        articles: ['guide-how-to-fill-in-form-c100'],
      },
      {
        name: 'Complete Supplemental Form C1A (Allegations of Harm)',
        slug: 'step-complete-c1a',
        description: 'Disclose any domestic abuse, child safety risks, or safeguarding concerns to the court.',
        order: 4,
        isConditional: true,
        conditionCriteria: 'Required only when allegations of abuse, harm, or domestic violence are involved.',
        category: 'Safety',
        articles: ['guide-form-c1a-allegations-of-harm'],
      },
      {
        name: 'Complete Form C4 (Order for Child Whereabouts)',
        slug: 'step-complete-c4',
        description: 'Ask the court to subpoena government bodies or third parties to locate a withheld child.',
        order: 5,
        isConditional: true,
        conditionCriteria: 'Required only when the other parent is concealing the child’s address.',
        category: 'Emergency',
        articles: ['guide-how-to-fill-in-form-c100'],
      },
      {
        name: 'Submit Application & Receive Sealed Copy',
        slug: 'step-submit-c100',
        description: 'File with the family court gatekeeping team online or by post, and receive your sealed case number.',
        order: 6,
        isConditional: false,
        category: 'Filing',
        articles: ['guide-serving-sealed-court-documents'],
      },
      {
        name: 'Serve Sealed Documents on Respondent',
        slug: 'step-serve-sealed-copy',
        description: 'Serve the respondent parent with the sealed paperwork and file Certificate of Service Form C9.',
        order: 7,
        isConditional: false,
        category: 'Service',
        articles: ['guide-serving-sealed-court-documents'],
      },
      {
        name: 'Attend Cafcass Telephone Safeguarding Interview',
        slug: 'step-cafcass-interview',
        description: 'Speak with the assigned Cafcass officer to complete initial child safety and background checks.',
        order: 8,
        isConditional: false,
        category: 'Cafcass',
        articles: ['guide-cafcass-interview-preparation'],
      },
      {
        name: 'Review Cafcass Safeguarding Letter',
        slug: 'step-review-safeguarding-letter',
        description: 'Examine Cafcass findings and recommendations before attending the first court hearing.',
        order: 9,
        isConditional: false,
        category: 'Cafcass',
        articles: ['guide-cafcass-interview-preparation'],
      },
      {
        name: 'Draft Position Statement for First Hearing (FHDRA)',
        slug: 'step-fhdra-position-statement',
        description: 'Prepare a 2-page position statement summarizing current contact and what directions you seek.',
        order: 10,
        isConditional: false,
        category: 'Hearing Prep',
        articles: ['guide-drafting-position-statement'],
      },
      {
        name: 'Attend First Hearing Dispute Resolution Appointment (FHDRA)',
        slug: 'step-attend-fhdra',
        description: 'Appear before the judge or magistrates to attempt resolution or set a trial directions timetable.',
        order: 11,
        isConditional: false,
        category: 'Hearing',
        articles: ['guide-drafting-position-statement'],
      },
      {
        name: 'Draft Court-Ordered Scott Schedule',
        slug: 'step-draft-scott-schedule',
        description: 'Populate the structured allegation table detailing incidents, dates, and evidence references.',
        order: 12,
        isConditional: true,
        conditionCriteria: 'Required only if the judge orders a Fact Finding hearing on disputed abuse allegations.',
        category: 'Fact Finding',
        articles: ['guide-drafting-scott-schedule'],
      },
      {
        name: 'Request Third-Party Disclosures (Police / Social Services)',
        slug: 'step-request-disclosures',
        description: 'File court orders requiring Police 999 logs, medical records, or school reports to be released.',
        order: 13,
        isConditional: true,
        conditionCriteria: 'Required when institutional evidence is necessary to substantiate allegations.',
        category: 'Disclosures',
        articles: ['guide-drafting-scott-schedule'],
      },
      {
        name: 'Attend Fact Finding Hearing',
        slug: 'step-attend-fact-finding',
        description: 'Provide oral evidence, cross-examine on allegations, and receive the judge’s factual findings.',
        order: 14,
        isConditional: true,
        conditionCriteria: 'Ordered by court when disputed allegations must be determined before final orders.',
        category: 'Hearing',
        articles: ['guide-drafting-scott-schedule'],
      },
      {
        name: 'Cooperate with Cafcass Section 7 Welfare Report',
        slug: 'step-cafcass-section-7',
        description: 'Facilitate home visits, child wishes & feelings interviews, and review Section 7 recommendations.',
        order: 15,
        isConditional: true,
        conditionCriteria: 'Ordered when comprehensive welfare assessment is needed prior to final disposal.',
        category: 'Cafcass',
        articles: ['guide-cafcass-interview-preparation'],
      },
      {
        name: 'Prepare Trial Bundle Strictly Following PD27A',
        slug: 'step-prepare-trial-bundle',
        description: 'Create an indexed, paginated electronic bundle containing orders, statements, and key reports.',
        order: 16,
        isConditional: false,
        category: 'Trial Prep',
        articles: ['guide-drafting-position-statement'],
      },
      {
        name: 'Attend Final Hearing & Secure Sealed Court Order',
        slug: 'step-attend-final-hearing',
        description: 'Present final arguments, address the Section 1(3) Welfare Checklist, and receive your binding order.',
        order: 17,
        isConditional: false,
        category: 'Final Order',
        articles: ['guide-drafting-position-statement'],
      },
    ];

    const stepMap = {};
    for (const s of steps) {
      let stepId;
      const existing = await client.query('SELECT id FROM guidance_steps WHERE slug = $1', [s.slug]);
      if (existing.rows.length > 0) {
        stepId = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO guidance_steps (document_id, name, slug, description, "order", is_conditional, condition_criteria, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [generateDocId(), s.name, s.slug, s.description, s.order, s.isConditional, s.conditionCriteria, s.category]
        );
        stepId = res.rows[0].id;
      }
      stepMap[s.slug] = stepId;

      // Link step to articles
      for (let ord = 0; ord < s.articles.length; ord++) {
        const aSlug = s.articles[ord];
        const aId = artMap[aSlug];
        if (aId) {
          await client.query(
            `INSERT INTO guidance_steps_articles_lnk (guidance_step_id, guidance_article_id, guidance_article_ord)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [stepId, aId, ord + 1]
          );
        }
      }
    }
    console.log(`  ✔ Seeded ${Object.keys(stepMap).length} guidance steps.`);

    // 4. Journeys
    console.log('🗺️ Seeding Guidance Journeys...');
    const journeys = [
      {
        name: '1. Mediation & MIAM Pre-Court Requirement',
        slug: 'journey-mediation-miam',
        description: 'Statutory family mediation assessment or exemption sign-off prior to court application.',
        type: 'Pre-Court',
        order: 1,
        steps: ['step-attend-miam', 'step-help-with-fees'],
      },
      {
        name: '2. Apply to Court (C100 & Supporting Forms)',
        slug: 'journey-apply-to-court',
        description: 'Drafting, filing, and legally serving Form C100, Form C1A, Form C4, and fee exemptions.',
        type: 'Application',
        order: 2,
        steps: [
          'step-complete-c100',
          'step-complete-c1a',
          'step-complete-c4',
          'step-submit-c100',
          'step-serve-sealed-copy',
        ],
      },
      {
        name: '3. Cafcass Safeguarding & Background Checks',
        slug: 'journey-cafcass-safeguarding',
        description: 'Independent telephone interview and background check by the court children officer.',
        type: 'Assessment',
        order: 3,
        steps: ['step-cafcass-interview', 'step-review-safeguarding-letter'],
      },
      {
        name: '4. First Hearing (FHDRA) & Directions',
        slug: 'journey-fhdra-first-hearing',
        description: 'The first court appearance before the bench to define issues in dispute and issue timetable orders.',
        type: 'Hearing',
        order: 4,
        steps: ['step-fhdra-position-statement', 'step-attend-fhdra'],
      },
      {
        name: '5. Evidence & Fact Finding Hearing',
        slug: 'journey-fact-finding-hearing',
        description: 'Adjudication on disputed domestic abuse or harm allegations via Scott Schedule and third-party records.',
        type: 'Hearing',
        order: 5,
        steps: ['step-draft-scott-schedule', 'step-request-disclosures', 'step-attend-fact-finding'],
      },
      {
        name: '6. Cafcass Section 7 Welfare Investigation',
        slug: 'journey-cafcass-section-7',
        description: 'Comprehensive welfare assessment, child wishes & feelings, and formal living arrangement recommendations.',
        type: 'Assessment',
        order: 6,
        steps: ['step-cafcass-section-7'],
      },
      {
        name: '7. Final Hearing & Court Order',
        slug: 'journey-final-hearing',
        description: 'Trial bundle preparation, final submissions on the Welfare Checklist, and issuance of binding orders.',
        type: 'Finalization',
        order: 7,
        steps: ['step-prepare-trial-bundle', 'step-attend-final-hearing'],
      },
    ];

    const journeyMap = {};
    for (const j of journeys) {
      let jId;
      const existing = await client.query('SELECT id FROM guidance_journeys WHERE slug = $1', [j.slug]);
      if (existing.rows.length > 0) {
        jId = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO guidance_journeys (document_id, name, slug, description, type, "order")
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [generateDocId(), j.name, j.slug, j.description, j.type, j.order]
        );
        jId = res.rows[0].id;
      }
      journeyMap[j.slug] = jId;

      // Link journey to steps
      for (let ord = 0; ord < j.steps.length; ord++) {
        const sSlug = j.steps[ord];
        const sId = stepMap[sSlug];
        if (sId) {
          await client.query(
            `INSERT INTO guidance_journeys_steps_lnk (guidance_journey_id, guidance_step_id, guidance_step_ord)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [jId, sId, ord + 1]
          );
        }
      }
    }
    console.log(`  ✔ Seeded ${Object.keys(journeyMap).length} guidance journeys.`);

    // 5. Maps
    console.log('🗺️ Seeding Guidance Maps...');
    const maps = [
      {
        name: 'Child Arrangements Order (CAO C100)',
        slug: 'child-arrangements-order-c100',
        description: 'Complete procedural roadmap for unrepresented parents seeking a court order for child residence, contact, or parental responsibility under Section 8 of the Children Act 1989.',
        category: 'Private Law (Children)',
        preconditions: 'Must attend a Mediation Information & Assessment Meeting (MIAM) unless eligible for an exemption under Family Procedure Rule 3.8 (e.g. domestic violence evidence).',
        postconditions: 'Legally enforceable Child Arrangements Order determining living arrangements and contact schedules.',
        journeys: [
          'journey-mediation-miam',
          'journey-apply-to-court',
          'journey-cafcass-safeguarding',
          'journey-fhdra-first-hearing',
          'journey-fact-finding-hearing',
          'journey-cafcass-section-7',
          'journey-final-hearing',
        ],
      },
      {
        name: 'Enforcement of Child Arrangements (C79)',
        slug: 'enforcement-child-arrangements-c79',
        description: 'Roadmap for enforcing an existing Child Arrangements Order when one parent breaches or denies court-ordered contact without reasonable excuse.',
        category: 'Enforcement',
        preconditions: 'An existing court order containing a warning notice that has been breached.',
        postconditions: 'Enforcement order with compensation for financial loss, unpaid work requirement, or variation of residence.',
        journeys: [
          'journey-c79-pre-enforcement',
          'journey-c79-file-application',
          'journey-c79-court-hearings',
          'journey-c79-sanctions-disposal',
        ],
      },
    ];

    for (const m of maps) {
      let mapId;
      const existing = await client.query('SELECT id FROM guidance_maps WHERE slug = $1', [m.slug]);
      if (existing.rows.length > 0) {
        mapId = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO guidance_maps (document_id, name, slug, description, category, preconditions, postconditions)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [generateDocId(), m.name, m.slug, m.description, m.category, m.preconditions, m.postconditions]
        );
        mapId = res.rows[0].id;
      }

      // Link map to journeys
      for (let ord = 0; ord < m.journeys.length; ord++) {
        const jSlug = m.journeys[ord];
        const jId = journeyMap[jSlug];
        if (jId) {
          await client.query(
            `INSERT INTO guidance_maps_journeys_lnk (guidance_map_id, guidance_journey_id, guidance_journey_ord)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [mapId, jId, ord + 1]
          );
        }
      }
    }
    console.log(`  ✔ Seeded ${maps.length} guidance maps.`);

    console.log('\n🎉 UK Family Court Guidance Database Seeding Completed Successfully!');
  } finally {
    if (shouldClose) {
      await client.end().catch(() => {});
    }
  }
}

module.exports = { seedGuidance };

if (require.main === module) {
  seedGuidance().catch((err) => {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  });
}
