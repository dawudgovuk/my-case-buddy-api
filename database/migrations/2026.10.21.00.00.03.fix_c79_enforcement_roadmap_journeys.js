/**
 * Migration: 2026.10.21.00.00.03.fix_c79_enforcement_roadmap_journeys.js
 * Description: Replaces erroneously linked C100 journeys on the C79 Enforcement roadmap
 *              with legally accurate UK Family Court C79 Enforcement journeys, steps, and articles
 *              under FPR Part 33 and Section 11J-P Children Act 1989.
 */

async function executeSql(ctx, sql, params = []) {
  if (typeof ctx.raw === 'function') {
    return ctx.raw(sql, params);
  }
  if (typeof ctx.query === 'function') {
    return ctx.query(sql, params);
  }
  throw new Error('Unsupported migration context: neither ctx.raw nor ctx.query is available');
}

function generateDocId(prefix) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4, 10)}`;
}

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Insert C79 Guidance Articles
    const articles = [
      {
        slug: 'guide-c79-warning-notice',
        title: 'Enforcing Child Arrangements: Warning Notice & Breach Thresholds',
        category: 'Enforcement',
        keywords: 'c79, enforcement, warning notice, breach, reasonable excuse, children act 1989',
        content: `### When Can You Enforce a Child Arrangements Order?
Under Section 11J of the Children Act 1989 and Family Procedure Rule (FPR) Part 33, a parent or guardian may apply to the Family Court to enforce a Child Arrangements Order if:
1. The court has made an order requiring a person to allow contact with a child or arrange for a child to live with a person.
2. The order has an endorsed **Warning Notice** (under FPR Rule 33.15).
3. The other party has breached the order without a **reasonable excuse**.

#### The Mandatory Warning Notice Check
- Check page 1 or the endorsement page of your existing order for the statutory warning notice:
  > *"Where a child arrangements order is in force: if you do not comply with the directions contained in this order you may be committed to prison, or directed to undertake unpaid work, or fined."*
- **If your order does NOT contain a Warning Notice**: The court cannot make an enforcement order yet. You must first apply on **Form C2** asking the court to attach a warning notice to the existing order.

#### Compiling Evidence of Non-Compliance
To convince the court to act, prepare clear documentation:
- **Timestamped Contact Log**: Exact dates, collection times, and what occurred (e.g. "Arrived at 10:00 AM at agreed handover location; respondent failed to present child").
- **Direct Refusal Evidence**: Save SMS, WhatsApp, or email transcripts containing direct refusals.
- **Financial Proof**: Receipts, tickets, or booking confirmations for activities that were cancelled as a direct result of denied contact.`,
        refs: ['form-c79', 'form-c2'],
      },
      {
        slug: 'guide-c79-completing-form-and-filing',
        title: 'How to Complete & File Form C79 (Enforcement Application)',
        category: 'Application',
        keywords: 'form c79, filing, ex160, court fee, enforcement application',
        content: `### Completing Court Form C79
Form C79 is the official HMCTS application form to enforce an order regarding contact or living arrangements.

#### Key Sections to Complete:
1. **Section 1: Details of Order**: State the exact date the order was made, the court that made it, and confirm that a Warning Notice is attached.
2. **Section 2: The Breaches**: List each specific paragraph and date breached. Keep descriptions strictly factual: "On Saturday 14th June at 10:00, the respondent refused to allow contact without explanation."
3. **Section 3: Sanctions Sought**: Tick what order you are requesting:
   - An **Enforcement Order (Unpaid Work)**: 40 to 200 hours of community service.
   - **Financial Loss Compensation**: Repayment of travel, accommodation, or activity expenses wasted due to breach.
   - **Variation of the Child Arrangements Order**: Changing handover protocols, supervised contact, or primary care.
4. **Statement of Truth**: You must sign and date under penalty of contempt of court.

#### Court Fee & Fee Remission (Form EX160)
The standard court issue fee for Form C79 is £255. If you receive means-tested benefits (e.g. Universal Credit) or have limited savings and income, complete **Form EX160** to receive an HWF fee waiver code before filing.`,
        refs: ['form-c79', 'form-ex160', 'hmcts-court-finder'],
      },
      {
        slug: 'guide-c79-hearings-and-reasonable-excuse',
        title: 'Enforcement Hearing & The "Reasonable Excuse" Legal Standard',
        category: 'Hearings',
        keywords: 'reasonable excuse, cafcass, s11M, hearing, enforcement defense',
        content: `### What Happens at an Enforcement Hearing?
The Family Court will list an initial Directions Hearing (usually within 20 working days).

#### Cafcass Breach Inquiries (Section 11M)
Under Section 11M of the Children Act 1989, the judge may instruct Cafcass (or CAFCASS Cymru) to:
- Conduct urgent telephone interviews with both parents.
- Ascertain whether the child has expressed reasons for reluctance or if parental alienation is occurring.
- Report on whether imposing sanctions would undermine the child's emotional wellbeing.

#### The "Reasonable Excuse" Defense (Section 11J(3))
If the breach is admitted or proven, the respondent has a complete defense if they can prove on the balance of probabilities that they had a **reasonable excuse** for failing to comply:
- **Valid Reasonable Excuses**: Severe medical emergency with hospital admission note, genuine immediate threat to the child's life or safety.
- **NOT Reasonable Excuses**: "The child didn't feel like going", routine birthday parties, minor sniffles, non-payment of child maintenance, or general hostility between parents.

#### Presenting Your Case
Bring 3 copies of your paginated Contact Log, the existing stamped Court Order, and your position statement.`,
        refs: ['form-c79', 'cafcass-welfare-checklist'],
      },
      {
        slug: 'guide-c79-sanctions-and-orders',
        title: 'Judicial Remedies: Unpaid Work, Financial Compensation & Variation',
        category: 'Finalization',
        keywords: 'unpaid work, financial compensation, variation, sanctions, contempt',
        content: `### What Sanctions Can the Judge Order?
If the judge finds beyond reasonable doubt that a party breached the order without a reasonable excuse, the court has powerful statutory powers under Sections 11J–P of the Children Act 1989:

#### 1. Unpaid Work Requirement (Section 11J)
- The court may sentence the breaching parent to between **40 and 200 hours** of unpaid community service.
- The Probation Service monitors attendance; failure to complete community service constitutes a separate criminal contempt.

#### 2. Order for Financial Compensation (Section 11O)
- If you incurred financial loss (plane tickets, train fares, missed holiday accommodation, petrol) as a direct consequence of the denied contact, the judge can order the respondent to pay you financial compensation directly.

#### 3. Variation of Living Arrangements & Residence
- Where persistent, deliberate obstruction of contact is established, the judge can order a full review and vary the child arrangements — including transferring the primary residence of the child to the other parent.

#### 4. Contempt of Court & Committal
- In extreme, deliberate, and protracted defiance of court authority, the judge can impose a suspended or immediate prison sentence for contempt of court.`,
        refs: ['form-c79'],
      },
    ];

    const artIdMap = {};
    for (const a of articles) {
      const existing = await executeSql(ctx, 'SELECT id FROM guidance_articles WHERE slug = $1', [a.slug]);
      let artId;
      if (existing.rows && existing.rows.length > 0) {
        artId = existing.rows[0].id;
        await executeSql(ctx, `
          UPDATE guidance_articles
          SET title = $1, content = $2, keywords = $3, category = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [a.title, a.content, a.keywords, a.category, artId]);
      } else {
        const res = await executeSql(ctx, `
          INSERT INTO guidance_articles (document_id, title, slug, content, keywords, category)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [generateDocId('gart'), a.title, a.slug, a.content, a.keywords, a.category]);
        artId = res.rows[0].id;
      }
      artIdMap[a.slug] = artId;

      // Link article to references
      for (let ord = 0; ord < a.refs.length; ord++) {
        const refSlug = a.refs[ord];
        const refRes = await executeSql(ctx, 'SELECT id FROM guidance_references WHERE slug = $1', [refSlug]);
        if (refRes.rows && refRes.rows.length > 0) {
          const refId = refRes.rows[0].id;
          const linkCheck = await executeSql(ctx, `
            SELECT id FROM guidance_articles_references_lnk
            WHERE guidance_article_id = $1 AND guidance_reference_id = $2
          `, [artId, refId]);
          if (!linkCheck.rows || linkCheck.rows.length === 0) {
            await executeSql(ctx, `
              INSERT INTO guidance_articles_references_lnk (guidance_article_id, guidance_reference_id, guidance_reference_ord)
              VALUES ($1, $2, $3)
            `, [artId, refId, ord + 1]);
          }
        }
      }
    }

    // 2. Insert C79 Guidance Steps
    const steps = [
      {
        slug: 'step-c79-warning-notice',
        name: 'Verify Warning Notice on Existing Order',
        description: 'Confirm that your order contains a statutory Warning Notice under FPR Rule 33.15. If absent, apply on Form C2 first.',
        order: 1,
        isConditional: false,
        category: 'Verification',
        article: 'guide-c79-warning-notice',
      },
      {
        slug: 'step-c79-breach-evidence',
        name: 'Compile Breach Evidence & Contact Logs',
        description: 'Assemble timestamped records of missed handovers, text refusals, police incident numbers, or lost financial expenses.',
        order: 2,
        isConditional: false,
        category: 'Evidence',
        article: 'guide-c79-warning-notice',
      },
      {
        slug: 'step-c79-complete-form',
        name: 'Complete Application Form C79',
        description: 'Fill in Form C79 identifying the exact paragraphs breached, dates, and sanctions sought.',
        order: 1,
        isConditional: false,
        category: 'Application',
        article: 'guide-c79-completing-form-and-filing',
      },
      {
        slug: 'step-c79-fee-or-ex160',
        name: 'Pay £255 Court Fee or Submit Form EX160',
        description: 'Pay the statutory court fee (£255) or provide your Help with Fees reference number on Form EX160.',
        order: 2,
        isConditional: true,
        conditionCriteria: 'Only required if applying for fee remission based on low income or state benefits.',
        category: 'Fees',
        article: 'guide-c79-completing-form-and-filing',
      },
      {
        slug: 'step-c79-serve-respondent',
        name: 'Serve Notice of Hearing on Respondent',
        description: 'Ensure the other parent receives the issued application and Notice of Hearing at least 14 days before the hearing date.',
        order: 3,
        isConditional: false,
        category: 'Service',
        article: 'guide-c79-completing-form-and-filing',
      },
      {
        slug: 'step-c79-cafcass-inquiries',
        name: 'Cafcass Section 11M Breach Inquiries',
        description: 'Cooperate with the Cafcass officer assessing reasons for non-compliance and child safety implications.',
        order: 1,
        isConditional: false,
        category: 'Cafcass',
        article: 'guide-c79-hearings-and-reasonable-excuse',
      },
      {
        slug: 'step-c79-attend-hearing',
        name: 'Attend Enforcement Directions Hearing',
        description: 'Present breach proof before the judge; respondent must prove a reasonable excuse on the balance of probabilities.',
        order: 2,
        isConditional: false,
        category: 'Hearing',
        article: 'guide-c79-hearings-and-reasonable-excuse',
      },
      {
        slug: 'step-c79-sanctions-orders',
        name: 'Court Sanctions & Order Variations',
        description: 'The judge determines sanctions under s.11J-P: 40-200 hours unpaid work, financial compensation, or varying primary care.',
        order: 1,
        isConditional: false,
        category: 'Remedies',
        article: 'guide-c79-sanctions-and-orders',
      },
    ];

    const stepIdMap = {};
    for (const s of steps) {
      const existing = await executeSql(ctx, 'SELECT id FROM guidance_steps WHERE slug = $1', [s.slug]);
      let stepId;
      if (existing.rows && existing.rows.length > 0) {
        stepId = existing.rows[0].id;
        await executeSql(ctx, `
          UPDATE guidance_steps
          SET name = $1, description = $2, "order" = $3, is_conditional = $4, condition_criteria = $5, category = $6, updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `, [s.name, s.description, s.order, s.isConditional, s.conditionCriteria || null, s.category, stepId]);
      } else {
        const res = await executeSql(ctx, `
          INSERT INTO guidance_steps (document_id, name, slug, description, "order", is_conditional, condition_criteria, category)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `, [generateDocId('gstep'), s.name, s.slug, s.description, s.order, s.isConditional, s.conditionCriteria || null, s.category]);
        stepId = res.rows[0].id;
      }
      stepIdMap[s.slug] = stepId;

      // Link step to article
      const artId = artIdMap[s.article];
      if (artId) {
        const linkCheck = await executeSql(ctx, `
          SELECT id FROM guidance_steps_articles_lnk
          WHERE guidance_step_id = $1 AND guidance_article_id = $2
        `, [stepId, artId]);
        if (!linkCheck.rows || linkCheck.rows.length === 0) {
          await executeSql(ctx, `
            INSERT INTO guidance_steps_articles_lnk (guidance_step_id, guidance_article_id, guidance_article_ord)
            VALUES ($1, $2, 1)
          `, [stepId, artId]);
        }
      }
    }

    // 3. Insert C79 Guidance Journeys
    const journeys = [
      {
        slug: 'journey-c79-pre-enforcement',
        name: '1. Pre-Enforcement Verification & Notice',
        description: 'Verify warning notice on your existing order and collate undeniable evidence of breach.',
        type: 'Preparation',
        order: 1,
        steps: ['step-c79-warning-notice', 'step-c79-breach-evidence'],
      },
      {
        slug: 'journey-c79-file-application',
        name: '2. Complete & File Form C79',
        description: 'Prepare Form C79, request fee exemption if eligible, and serve formal notice on the respondent.',
        type: 'Application',
        order: 2,
        steps: ['step-c79-complete-form', 'step-c79-fee-or-ex160', 'step-c79-serve-respondent'],
      },
      {
        slug: 'journey-c79-court-hearings',
        name: '3. Cafcass Inquiries & Enforcement Hearing',
        description: 'Safeguarding officer checks, the directions hearing, and examining the reasonable excuse defense.',
        type: 'Hearing',
        order: 3,
        steps: ['step-c79-cafcass-inquiries', 'step-c79-attend-hearing'],
      },
      {
        slug: 'journey-c79-sanctions-disposal',
        name: '4. Judicial Remedies & Sanctions',
        description: 'Community unpaid work requirements, financial loss compensation, and variation of residence.',
        type: 'Finalization',
        order: 4,
        steps: ['step-c79-sanctions-orders'],
      },
    ];

    const journeyIdMap = {};
    for (const j of journeys) {
      const existing = await executeSql(ctx, 'SELECT id FROM guidance_journeys WHERE slug = $1', [j.slug]);
      let jId;
      if (existing.rows && existing.rows.length > 0) {
        jId = existing.rows[0].id;
        await executeSql(ctx, `
          UPDATE guidance_journeys
          SET name = $1, description = $2, type = $3, "order" = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [j.name, j.description, j.type, j.order, jId]);
      } else {
        const res = await executeSql(ctx, `
          INSERT INTO guidance_journeys (document_id, name, slug, description, type, "order")
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [generateDocId('gjn'), j.name, j.slug, j.description, j.type, j.order]);
        jId = res.rows[0].id;
      }
      journeyIdMap[j.slug] = jId;

      // Link journey to steps
      for (let ord = 0; ord < j.steps.length; ord++) {
        const stepSlug = j.steps[ord];
        const stepId = stepIdMap[stepSlug];
        if (stepId) {
          const linkCheck = await executeSql(ctx, `
            SELECT id FROM guidance_journeys_steps_lnk
            WHERE guidance_journey_id = $1 AND guidance_step_id = $2
          `, [jId, stepId]);
          if (!linkCheck.rows || linkCheck.rows.length === 0) {
            await executeSql(ctx, `
              INSERT INTO guidance_journeys_steps_lnk (guidance_journey_id, guidance_step_id, guidance_step_ord)
              VALUES ($1, $2, $3)
            `, [jId, stepId, ord + 1]);
          }
        }
      }
    }

    // 4. Update Guidance Map for C79 Enforcement
    const mapRes = await executeSql(ctx, 'SELECT id FROM guidance_maps WHERE slug = $1', ['enforcement-child-arrangements-c79']);
    if (mapRes.rows && mapRes.rows.length > 0) {
      const mapId = mapRes.rows[0].id;

      // Remove previous erroneous links to C100 journeys
      await executeSql(ctx, 'DELETE FROM guidance_maps_journeys_lnk WHERE guidance_map_id = $1', [mapId]);

      // Insert new C79 journeys
      const c79JourneyOrder = [
        'journey-c79-pre-enforcement',
        'journey-c79-file-application',
        'journey-c79-court-hearings',
        'journey-c79-sanctions-disposal',
      ];

      for (let ord = 0; ord < c79JourneyOrder.length; ord++) {
        const jSlug = c79JourneyOrder[ord];
        const jId = journeyIdMap[jSlug];
        if (jId) {
          await executeSql(ctx, `
            INSERT INTO guidance_maps_journeys_lnk (guidance_map_id, guidance_journey_id, guidance_journey_ord)
            VALUES ($1, $2, $3)
          `, [mapId, jId, ord + 1]);
        }
      }
    }
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    const mapRes = await executeSql(ctx, 'SELECT id FROM guidance_maps WHERE slug = $1', ['enforcement-child-arrangements-c79']);
    if (mapRes.rows && mapRes.rows.length > 0) {
      const mapId = mapRes.rows[0].id;
      await executeSql(ctx, 'DELETE FROM guidance_maps_journeys_lnk WHERE guidance_map_id = $1', [mapId]);
    }

    const c79Journeys = [
      'journey-c79-pre-enforcement',
      'journey-c79-file-application',
      'journey-c79-court-hearings',
      'journey-c79-sanctions-disposal',
    ];

    for (const jSlug of c79Journeys) {
      const jRes = await executeSql(ctx, 'SELECT id FROM guidance_journeys WHERE slug = $1', [jSlug]);
      if (jRes.rows && jRes.rows.length > 0) {
        const jId = jRes.rows[0].id;
        await executeSql(ctx, 'DELETE FROM guidance_journeys_steps_lnk WHERE guidance_journey_id = $1', [jId]);
        await executeSql(ctx, 'DELETE FROM guidance_journeys WHERE id = $1', [jId]);
      }
    }

    const c79Steps = [
      'step-c79-warning-notice',
      'step-c79-breach-evidence',
      'step-c79-complete-form',
      'step-c79-fee-or-ex160',
      'step-c79-serve-respondent',
      'step-c79-cafcass-inquiries',
      'step-c79-attend-hearing',
      'step-c79-sanctions-orders',
    ];

    for (const sSlug of c79Steps) {
      const sRes = await executeSql(ctx, 'SELECT id FROM guidance_steps WHERE slug = $1', [sSlug]);
      if (sRes.rows && sRes.rows.length > 0) {
        const sId = sRes.rows[0].id;
        await executeSql(ctx, 'DELETE FROM guidance_steps_articles_lnk WHERE guidance_step_id = $1', [sId]);
        await executeSql(ctx, 'DELETE FROM guidance_steps WHERE id = $1', [sId]);
      }
    }

    const c79Articles = [
      'guide-c79-warning-notice',
      'guide-c79-completing-form-and-filing',
      'guide-c79-hearings-and-reasonable-excuse',
      'guide-c79-sanctions-and-orders',
    ];

    for (const aSlug of c79Articles) {
      const aRes = await executeSql(ctx, 'SELECT id FROM guidance_articles WHERE slug = $1', [aSlug]);
      if (aRes.rows && aRes.rows.length > 0) {
        const aId = aRes.rows[0].id;
        await executeSql(ctx, 'DELETE FROM guidance_articles_references_lnk WHERE guidance_article_id = $1', [aId]);
        await executeSql(ctx, 'DELETE FROM guidance_articles WHERE id = $1', [aId]);
      }
    }
  },
};
