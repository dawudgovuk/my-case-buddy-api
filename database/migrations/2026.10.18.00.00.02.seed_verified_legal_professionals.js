/**
 * Migration: 2026.10.18.00.00.02.seed_verified_legal_professionals.js
 * Description: Seeds verified UK legal professionals (McKenzie Friends, Solicitors, Barristers)
 *              into up_users and up_users_role_lnk so the Verified Legal Directory is populated.
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
    await executeSql(ctx, `
      DO $$
      DECLARE
        auth_role_id INT;
        p RECORD;
        new_user_id INT;
        pros JSONB := '[
          {
            "username": "sarah_mckenzie",
            "email": "sarah.mckenzie@mycasebuddy.org.uk",
            "name": "Sarah Jenkins",
            "user_role": "McKenzieFriend",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "Experienced McKenzie Friend with 6+ years supporting litigants in person through Child Arrangements disputes, position statement drafting, and court hearings.",
            "years_experience": 6,
            "specialisms": ["Child Arrangements", "Fact-Finding Hearings", "FHDRA & DRA"]
          },
          {
            "username": "kevin_mckenzie",
            "email": "kevin.mckenzie@mycasebuddy.org.uk",
            "name": "Kevin Moore",
            "user_role": "McKenzieFriend",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "Specialist McKenzie Friend offering procedural advice and emotional support for family court proceedings.",
            "years_experience": 4,
            "specialisms": ["Domestic Abuse", "Child Arrangements"]
          },
          {
            "username": "david_solicitor",
            "email": "david.vance@vancelaw.co.uk",
            "name": "David Vance",
            "user_role": "Solicitor",
            "firm": "Vance & Partners Family Law LLP",
            "registration_number": "SRA-682910",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "Senior Family Law Solicitor specializing in complex child arrangements and financial remedies.",
            "years_experience": 14,
            "specialisms": ["Care Proceedings", "Financial Remedies", "Private Law"]
          },
          {
            "username": "hannah_solicitor",
            "email": "hannah.brown@brownsolicitors.co.uk",
            "name": "Hannah Brown",
            "user_role": "Solicitor",
            "firm": "Brown & Co Solicitors",
            "registration_number": "SRA-741209",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "Solicitor focusing on emergency non-molestation orders and child protection matters.",
            "years_experience": 9,
            "specialisms": ["Non-Molestation Orders", "Child Protection"]
          },
          {
            "username": "eleanor_barrister",
            "email": "eleanor.rigby@apexchambers.co.uk",
            "name": "Eleanor Rigby KC",
            "user_role": "Barrister",
            "firm": "Apex Family Chambers, London",
            "registration_number": "BSB-49201",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "King''s Counsel specializing in High Court family division appeals, contested care orders, and multi-day fact-finding hearings.",
            "years_experience": 20,
            "specialisms": ["High Court Family Division", "Appeals", "Complex Fact-Finding"]
          },
          {
            "username": "oliver_barrister",
            "email": "oliver.anderson@templegate.co.uk",
            "name": "Oliver Anderson",
            "user_role": "Barrister",
            "firm": "Temple Gate Chambers",
            "registration_number": "BSB-55312",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "bio": "Family law barrister with substantial advocacy experience in financial remedies and dispute resolution.",
            "years_experience": 11,
            "specialisms": ["Financial Remedies", "Child Arrangements"]
          }
        ]'::jsonb;
      BEGIN
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;
        IF auth_role_id IS NULL THEN
          auth_role_id := 1;
        END IF;

        FOR p IN SELECT * FROM jsonb_to_recordset(pros) AS (
          username TEXT,
          email TEXT,
          name TEXT,
          user_role TEXT,
          firm TEXT,
          registration_number TEXT,
          subscription_tier TEXT,
          subscription_status TEXT,
          bio TEXT,
          years_experience INT,
          specialisms JSONB
        )
        LOOP
          -- Check if user already exists
          SELECT id INTO new_user_id FROM up_users WHERE email = p.email LIMIT 1;

          IF new_user_id IS NULL THEN
            INSERT INTO up_users (
              document_id,
              username,
              email,
              name,
              user_role,
              firm,
              registration_number,
              subscription_tier,
              subscription_status,
              bio,
              years_experience,
              specialisms,
              confirmed,
              blocked,
              provider,
              created_at,
              updated_at,
              published_at
            ) VALUES (
              substring(md5(random()::text || clock_timestamp()::text) from 1 for 24),
              p.username,
              p.email,
              p.name,
              p.user_role,
              p.firm,
              p.registration_number,
              p.subscription_tier,
              p.subscription_status,
              p.bio,
              p.years_experience,
              p.specialisms,
              TRUE,
              FALSE,
              'local',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            RETURNING id INTO new_user_id;

            -- Link to Authenticated role
            INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
            VALUES (new_user_id, auth_role_id, 1)
            ON CONFLICT DO NOTHING;
          ELSE
            -- Update existing record to ensure verified state and professional fields are present
            UPDATE up_users
            SET
              name = p.name,
              user_role = p.user_role,
              firm = COALESCE(p.firm, firm),
              registration_number = COALESCE(p.registration_number, registration_number),
              bio = p.bio,
              years_experience = p.years_experience,
              specialisms = p.specialisms,
              confirmed = TRUE,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = new_user_id;

            -- Ensure role link exists
            IF NOT EXISTS (SELECT 1 FROM up_users_role_lnk WHERE user_id = new_user_id AND role_id = auth_role_id) THEN
              INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
              VALUES (new_user_id, auth_role_id, 1);
            END IF;
          END IF;
        END LOOP;
      END $$;
    `);
  },

  /**
   * Revert migration
   */
  async down(ctx) {
    await executeSql(ctx, `
      DELETE FROM up_users WHERE email IN (
        'sarah.mckenzie@mycasebuddy.org.uk',
        'kevin.mckenzie@mycasebuddy.org.uk',
        'david.vance@vancelaw.co.uk',
        'hannah.brown@brownsolicitors.co.uk',
        'eleanor.rigby@apexchambers.co.uk',
        'oliver.anderson@templegate.co.uk'
      );
    `);
  },
};
