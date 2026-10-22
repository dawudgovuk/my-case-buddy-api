/**
 * Migration: 2026.10.22.00.00.06.create_email_templates_and_seed_defaults.js
 * Description: 
 *   1. Updates Strapi's built-in users-permissions email templates (email_confirmation & reset_password)
 *      in strapi_core_store_settings with branded UK Family Court HTML templates.
 *   2. Creates the email_templates table with full i18n support for custom application emails
 *      (registration_confirmation, email_verification, case_invite, peer_support_request, peer_support_accepted).
 *   3. Grants permissions for email_templates to Public and Authenticated roles.
 *   4. Seeds initial templates across English, Welsh, Hindi, Bengali, Spanish, and Polish.
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

function sqlStr(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'` + String(str).replace(/'/g, "''") + `'`;
}

const BRAND_STYLE = {
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  primary: '#2b4acb',
  primaryDark: '#1e2f86',
  slateDark: '#0f172a',
  slateText: '#334155',
  slateMuted: '#64748b',
  bgSoft: '#f8fafc',
  border: '#e2e8f0',
};

function wrapEmailHtml(title, eyebrow, heroTitle, heroSubtitle, bodyHtml) {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0;padding:24px 0;background-color:#f1f5f9;font-family:${BRAND_STYLE.font};">
  <tr>
    <td align="center">
      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.06);border:1px solid ${BRAND_STYLE.border};">
        <!-- Top Header -->
        <tr>
          <td style="padding:24px 32px;background:linear-gradient(135deg,#1e2f86 0%,#2b4acb 55%,#4b5fe0 100%);color:#ffffff;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#c9d4fb;margin-bottom:4px;">${eyebrow}</div>
                  <h1 style="margin:0;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;">${heroTitle}</h1>
                  <p style="margin:6px 0 0 0;font-size:14px;line-height:20px;color:#e0e7ff;">${heroSubtitle}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Main Body -->
        <tr>
          <td style="padding:32px;color:${BRAND_STYLE.slateText};font-size:15px;line-height:24px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid ${BRAND_STYLE.border};font-size:12px;line-height:18px;color:${BRAND_STYLE.slateMuted};">
            <p style="margin:0 0 6px 0;"><strong>My Case Buddy</strong> &bull; UK Family Court Digital Workspace</p>
            <p style="margin:0;">Family Procedure Rules (FPR Part 12 &amp; PD 27A) Safeguarding Compliance &bull; <a href="mailto:support@mycasebuddy.justice.gov.uk" style="color:${BRAND_STYLE.primary};text-decoration:none;">support@mycasebuddy.justice.gov.uk</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// Built-in Users-Permissions Email Confirmation Template
const USERS_PERM_EMAIL_CONFIRMATION_HTML = wrapEmailHtml(
  'Confirm your My Case Buddy account',
  'Account Safeguarding',
  'Confirm your email address',
  'One click and your UK Family Court account is activated.',
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND_STYLE.slateText};">
    Dear <strong style="color:${BRAND_STYLE.slateDark};"><%= USER.username %></strong>,
  </p>
  <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND_STYLE.slateText};">
    Thank you for registering with <strong>My Case Buddy</strong>. To protect the privacy and confidentiality of Family Court proceedings under Family Procedure Rules (FPR Part 12), please verify your email address to activate your account.
  </p>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
    <tr>
      <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
        <a href="<%= URL %>?confirmation=<%= CODE %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Confirm Email Address &rarr;</a>
      </td>
    </tr>
  </table>
  <div style="margin:20px 0;padding:14px;border-radius:10px;background-color:#f8fafc;border:1px solid ${BRAND_STYLE.border};font-size:12px;line-height:18px;color:${BRAND_STYLE.slateMuted};">
    Button not working? Copy this link into your browser:<br />
    <a href="<%= URL %>?confirmation=<%= CODE %>" target="_blank" style="color:${BRAND_STYLE.primary};word-break:break-all;"><%= URL %>?confirmation=<%= CODE %></a>
  </div>
  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:${BRAND_STYLE.slateMuted};">
    This confirmation link expires in 24 hours. If you did not create an account on My Case Buddy, please disregard this email.
  </p>`
);

// Built-in Users-Permissions Password Reset Template
const USERS_PERM_RESET_PASSWORD_HTML = wrapEmailHtml(
  'Reset your My Case Buddy password',
  'Account Security',
  'Reset your password',
  'Follow the instructions below to choose a new password.',
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND_STYLE.slateText};">
    Dear <strong style="color:${BRAND_STYLE.slateDark};"><%= USER.username %></strong>,
  </p>
  <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND_STYLE.slateText};">
    We received a request to reset the password associated with your My Case Buddy account (<strong><%= USER.email %></strong>).
  </p>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
    <tr>
      <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
        <a href="<%= URL %>?code=<%= TOKEN %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Reset Password &rarr;</a>
      </td>
    </tr>
  </table>
  <div style="margin:20px 0;padding:14px;border-radius:10px;background-color:#f8fafc;border:1px solid ${BRAND_STYLE.border};font-size:12px;line-height:18px;color:${BRAND_STYLE.slateMuted};">
    Button not working? Copy this link into your browser:<br />
    <a href="<%= URL %>?code=<%= TOKEN %>" target="_blank" style="color:${BRAND_STYLE.primary};word-break:break-all;"><%= URL %>?code=<%= TOKEN %></a>
  </div>
  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:${BRAND_STYLE.slateMuted};">
    This password reset link expires in 24 hours. If you did not request a password reset, your account remains secure and you can ignore this notice.
  </p>`
);

module.exports = {
  /**
   * Apply migration
   */
  async up(ctx) {
    // 1. Update Strapi Users & Permissions Built-in Email Templates in strapi_core_store_settings
    const updatedUsersPermEmail = JSON.stringify({
      reset_password: {
        display: 'Email.template.reset_password',
        icon: 'sync',
        options: {
          from: {
            name: 'My Case Buddy Security',
            email: 'support@mycasebuddy.justice.gov.uk',
          },
          response_email: 'support@mycasebuddy.justice.gov.uk',
          object: 'Reset your My Case Buddy password',
          message: USERS_PERM_RESET_PASSWORD_HTML,
        },
      },
      email_confirmation: {
        display: 'Email.template.email_confirmation',
        icon: 'check-square',
        options: {
          from: {
            name: 'My Case Buddy Safeguarding',
            email: 'safeguarding@mycasebuddy.justice.gov.uk',
          },
          response_email: 'safeguarding@mycasebuddy.justice.gov.uk',
          object: 'Action Required: Verify your My Case Buddy account',
          message: USERS_PERM_EMAIL_CONFIRMATION_HTML,
        },
      },
    });

    await executeSql(ctx, `
      UPDATE strapi_core_store_settings
      SET value = ${sqlStr(updatedUsersPermEmail)}
      WHERE key = 'plugin_users-permissions_email';
    `);

    // 2. Create email_templates table
    await executeSql(ctx, `
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        template_key VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT,
        sender_name VARCHAR(255) DEFAULT 'My Case Buddy',
        sender_email VARCHAR(255) DEFAULT 'support@mycasebuddy.justice.gov.uk',
        active BOOLEAN DEFAULT TRUE,
        locale VARCHAR(255) DEFAULT 'en',
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by_id INTEGER,
        updated_by_id INTEGER
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_key_locale ON email_templates (template_key, locale);
      CREATE INDEX IF NOT EXISTS idx_email_templates_doc_locale ON email_templates (document_id, locale);
      CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates (active);
    `);

    // 3. Grant find & findOne permissions to Public & Authenticated roles
    await executeSql(ctx, `
      DO $$
      DECLARE
        pub_role_id INT;
        auth_role_id INT;
        act TEXT;
        perm_id INT;
        actions TEXT[] := ARRAY[
          'api::email-template.email-template.find',
          'api::email-template.email-template.findOne'
        ];
      BEGIN
        SELECT id INTO pub_role_id FROM up_roles WHERE type = 'public' LIMIT 1;
        SELECT id INTO auth_role_id FROM up_roles WHERE type = 'authenticated' LIMIT 1;

        FOREACH act IN ARRAY actions LOOP
          SELECT id INTO perm_id FROM up_permissions WHERE action = act LIMIT 1;
          IF perm_id IS NULL THEN
            INSERT INTO up_permissions (document_id, action, created_at, updated_at, published_at)
            VALUES ('perm_' || md5(act), act, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id INTO perm_id;
          END IF;

          IF pub_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
            IF NOT EXISTS (
              SELECT 1 FROM up_permissions_role_lnk 
              WHERE permission_id = perm_id AND role_id = pub_role_id
            ) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id)
              VALUES (perm_id, pub_role_id);
            END IF;
          END IF;

          IF auth_role_id IS NOT NULL AND perm_id IS NOT NULL THEN
            IF NOT EXISTS (
              SELECT 1 FROM up_permissions_role_lnk 
              WHERE permission_id = perm_id AND role_id = auth_role_id
            ) THEN
              INSERT INTO up_permissions_role_lnk (permission_id, role_id)
              VALUES (perm_id, auth_role_id);
            END IF;
          END IF;
        END LOOP;
      END $$;
    `);

    // 4. Seed initial default email templates into email_templates (with multilingual translations)
    const templates = [
      // 1. registration_confirmation (English)
      {
        docId: 'tmpl_reg_confirmation',
        key: 'registration_confirmation',
        locale: 'en',
        name: 'Registration Confirmation & Practice Guide',
        subject: 'Registration Confirmed: Welcome to My Case Buddy (<%= roleDisplayName %>)',
        senderName: 'My Case Buddy Support',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'Dear <%= name %>,\n\nThank you for registering with My Case Buddy as a <%= roleDisplayName %> (Ref: <%= referenceId %>).\n\nYour account is created to support Family Court proceedings.\n\nWarm regards,\nMy Case Buddy Team',
        bodyHtml: wrapEmailHtml(
          'Registration Confirmed',
          'Registration Confirmed',
          'Welcome to My Case Buddy, <%= name %>',
          'Your account as a <strong><%= roleDisplayName %></strong> has been registered.',
          `<p>Dear <strong><%= name %></strong>,</p>
           <p>Thank you for registering as a <strong><%= roleDisplayName %></strong> with My Case Buddy (Registration Reference: <strong><%= referenceId %></strong>).</p>
           <p>Your participation is governed by England and Wales Family Procedure Rules (FPR) and Practice Guidance issued by the Head of Family Justice (July 2010).</p>
           <div style="margin:20px 0;padding:16px;background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
             <h3 style="margin:0 0 8px 0;font-size:14px;color:#0f172a;">Key Remit &amp; Capabilities</h3>
             <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;line-height:22px;">
               <li>Maintain strict confidentiality of all private family proceedings under FPR Rule 12.73.</li>
               <li>Provide moral support, note-taking, and quiet procedural advice.</li>
               <li>Do not disclose child details or court documents to unauthorized third parties.</li>
             </ul>
           </div>
           <p>A separate Verification Email has been sent to activate your account.</p>`
        ),
      },
      // 1b. registration_confirmation (Bengali)
      {
        docId: 'tmpl_reg_confirmation',
        key: 'registration_confirmation',
        locale: 'bn',
        name: 'নিবন্ধন নিশ্চিতকরণ ও প্র্যাকটিস গাইড',
        subject: 'নিবন্ধন নিশ্চিতকরণ: মাই কেস বাডিতে স্বাগতম (<%= roleDisplayName %>)',
        senderName: 'মাই কেস বাডি সাপোর্ট',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'প্রিয় <%= name %>,\n\nমাই কেস বাডিতে <%= roleDisplayName %> হিসেবে নিবন্ধনের জন্য ধন্যবাদ (রেফারেন্স: <%= referenceId %>)।\n\nপারিবারিক আদালতের কার্যধারা পরিচালনায় আপনার অ্যাকাউন্ট সক্রিয় করা হয়েছে।',
        bodyHtml: wrapEmailHtml(
          'নিবন্ধন নিশ্চিতকরণ',
          'নিবন্ধন সম্পন্ন',
          'মাই কেস বাডিতে স্বাগতম, <%= name %>',
          '<strong><%= roleDisplayName %></strong> হিসেবে আপনার অ্যাকাউন্ট নিবন্ধিত হয়েছে।',
          `<p>প্রিয় <strong><%= name %></strong>,</p>
           <p>মাই কেস বাডিতে <strong><%= roleDisplayName %></strong> হিসেবে নিবন্ধনের জন্য ধন্যবাদ (নিবন্ধন রেফারেন্স: <strong><%= referenceId %></strong>)।</p>
           <p>আপনার অংশগ্রহণ ইংল্যান্ড এবং ওয়েলসের পারিবারিক কার্যপ্রণালী বিধি (FPR) এবং পারিবারিক ন্যায়বিচার প্রধান কর্তৃক জারি করা প্র্যাকটিস গাইডেন্স (জুলাই ২০১০) দ্বারা নিয়ন্ত্রিত।</p>
           <p>আপনার অ্যাকাউন্ট সক্রিয় করার জন্য একটি পৃথক যাচাইকরণ ইমেল পাঠানো হয়েছে।</p>`
        ),
      },
      // 1c. registration_confirmation (Hindi)
      {
        docId: 'tmpl_reg_confirmation',
        key: 'registration_confirmation',
        locale: 'hi',
        name: 'पंजीकरण पुष्टि और अभ्यास मार्गदर्शिका',
        subject: 'पंजीकरण की पुष्टि: माई केस बडी में आपका स्वागत है (<%= roleDisplayName %>)',
        senderName: 'माई केस बडी सपोर्ट',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'प्रिय <%= name %>,\n\nमाई केस बडी में <%= roleDisplayName %> के रूप में पंजीकरण करने के लिए धन्यवाद (संदर्भ: <%= referenceId %>)।\n\nपारिवारिक अदालत की कार्यवाही के प्रबंधन के लिए आपका खाता बनाया गया है।',
        bodyHtml: wrapEmailHtml(
          'पंजीकरण की पुष्टि',
          'पंजीकरण पूर्ण',
          'माई केस बडी में आपका स्वागत है, <%= name %>',
          '<strong><%= roleDisplayName %></strong> के रूप में आपका खाता पंजीकृत किया गया है।',
          `<p>प्रिय <strong><%= name %></strong>,</p>
           <p>माई केस बडी में <strong><%= roleDisplayName %></strong> के रूप में पंजीकरण करने के लिए धन्यवाद (पंजीकरण संदर्भ: <strong><%= referenceId %></strong>)।</p>
           <p>आपकी भागीदारी इंग्लैंड और वेल्स के पारिवारिक प्रक्रिया नियमों (FPR) और पारिवारिक न्याय प्रमुख द्वारा जारी अभ्यास मार्गदर्शन (जुलाई 2010) द्वारा नियंत्रित है।</p>
           <p>अपने खाते को सक्रिय करने के लिए कृपया अपने इनबॉक्स में भेजा गया सत्यापन ईमेल देखें।</p>`
        ),
      },

      // 2. email_verification (English)
      {
        docId: 'tmpl_email_verification',
        key: 'email_verification',
        locale: 'en',
        name: 'Account Email Verification',
        subject: 'Action Required: Verify your <%= roleDisplayName %> account',
        senderName: 'My Case Buddy Safeguarding',
        senderEmail: 'safeguarding@mycasebuddy.justice.gov.uk',
        bodyText: 'Dear <%= name %>,\n\nPlease confirm your email address to activate your <%= roleDisplayName %> account:\n\n<%= verificationUrl %>\n\nExpires in 24 hours.',
        bodyHtml: wrapEmailHtml(
          'Confirm your email address',
          'Account Verification',
          'Confirm your email address',
          'One click and your <%= roleDisplayName %> profile is fully activated.',
          `<p>Dear <strong><%= name %></strong>,</p>
           <p>To keep Family Court proceedings safe and secure, please confirm your email address before reviewing cases or offering peer support.</p>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
                 <a href="<%= verificationUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Verify Email Address &rarr;</a>
               </td>
             </tr>
           </table>
           <div style="margin:20px 0;padding:14px;border-radius:10px;background-color:#f8fafc;border:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">
             Button not working? Copy this link into your browser:<br />
             <a href="<%= verificationUrl %>" target="_blank" style="color:${BRAND_STYLE.primary};word-break:break-all;"><%= verificationUrl %></a>
           </div>
           <p style="font-size:13px;color:#64748b;">Reference: <%= referenceId %> &bull; Link expires in 24 hours.</p>`
        ),
      },
      // 2b. email_verification (Bengali)
      {
        docId: 'tmpl_email_verification',
        key: 'email_verification',
        locale: 'bn',
        name: 'অ্যাকাউন্ট ইমেল যাচাইকরণ',
        subject: 'পদক্ষেপ আবশ্যক: আপনার <%= roleDisplayName %> অ্যাকাউন্ট যাচাই করুন',
        senderName: 'মাই কেস বাডি সুরক্ষা বিভাগ',
        senderEmail: 'safeguarding@mycasebuddy.justice.gov.uk',
        bodyText: 'প্রিয় <%= name %>,\n\nআপনার <%= roleDisplayName %> অ্যাকাউন্ট সক্রিয় করতে নিচের লিঙ্কে ক্লিক করুন:\n\n<%= verificationUrl %>\n\nমেয়াদ: ২৪ ঘণ্টা।',
        bodyHtml: wrapEmailHtml(
          'আপনার ইমেল ঠিকানা নিশ্চিত করুন',
          'অ্যাকাউন্ট যাচাইকরণ',
          'আপনার ইমেল ঠিকানা নিশ্চিত করুন',
          'এক ক্লিকেই আপনার <%= roleDisplayName %> অ্যাকাউন্ট সক্রিয় করুন।',
          `<p>প্রিয় <strong><%= name %></strong>,</p>
           <p>পারিবারিক আদালতের তথ্য সুরক্ষিত রাখতে, মামলা পর্যালোচনা বা সহায়তা প্রদানের পূর্বে অনুগ্রহ করে আপনার ইমেল নিশ্চিত করুন।</p>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
                 <a href="<%= verificationUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">ইমেল যাচাই করুন &rarr;</a>
               </td>
             </tr>
           </table>
           <p style="font-size:13px;color:#64748b;">রেফারেন্স: <%= referenceId %> &bull; এই লিঙ্কটির মেয়াদ ২৪ ঘণ্টা।</p>`
        ),
      },
      // 2c. email_verification (Hindi)
      {
        docId: 'tmpl_email_verification',
        key: 'email_verification',
        locale: 'hi',
        name: 'खाता ईमेल सत्यापन',
        subject: 'कार्रवाई आवश्यक: अपना <%= roleDisplayName %> खाता सत्यापित करें',
        senderName: 'माई केस बडी सुरक्षा विभाग',
        senderEmail: 'safeguarding@mycasebuddy.justice.gov.uk',
        bodyText: 'प्रिय <%= name %>,\n\nअपना <%= roleDisplayName %> खाता सक्रिय करने के लिए कृपया नीचे दिए गए लिंक पर क्लिक करें:\n\n<%= verificationUrl %>\n\nवैधता: 24 घंटे।',
        bodyHtml: wrapEmailHtml(
          'अपने ईमेल पते की पुष्टि करें',
          'खाता सत्यापन',
          'अपने ईमेल पते की पुष्टि करें',
          'एक क्लिक में अपनी <%= roleDisplayName %> प्रोफ़ाइल सक्रिय करें।',
          `<p>प्रिय <strong><%= name %></strong>,</p>
           <p>पारिवारिक अदालत की जानकारी को सुरक्षित रखने के लिए, मामलों की समीक्षा करने या सहायता देने से पहले कृपया अपने ईमेल की पुष्टि करें।</p>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
                 <a href="<%= verificationUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">ईमेल सत्यापित करें &rarr;</a>
               </td>
             </tr>
           </table>
           <p style="font-size:13px;color:#64748b;">संदर्भ: <%= referenceId %> &bull; यह लिंक 24 घंटे में समाप्त हो जाएगा।</p>`
        ),
      },

      // 3. case_invite (English)
      {
        docId: 'tmpl_case_invite',
        key: 'case_invite',
        locale: 'en',
        name: 'Case Team Collaboration Invitation',
        subject: 'Case Invitation: You have been invited to join <%= caseTitle %> (<%= roleDisplayName %>)',
        senderName: 'My Case Buddy Case Management',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'Dear <%= inviteeName %>,\n\nYou have been invited by <%= inviterName %> to join <%= caseTitle %> as a <%= roleDisplayName %>.\n\nAccept Invitation: <%= inviteUrl %>\n\nValid for 30 days.',
        bodyHtml: wrapEmailHtml(
          'Case Team Invitation',
          'Case Collaboration',
          'You have been invited to a case',
          '<%= inviterName %> has invited you as a <%= roleDisplayName %>.',
          `<p>Dear <strong><%= inviteeName %></strong>,</p>
           <p>You have been invited by <strong><%= inviterName %></strong> to join the family court case team for <strong><%= caseTitle %></strong> (Reference: <strong><%= caseNumber %></strong>).</p>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
                 <a href="<%= inviteUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Accept Invitation &rarr;</a>
               </td>
             </tr>
           </table>
           <p style="font-size:13px;color:#64748b;">This secure invitation link is valid for 30 days.</p>`
        ),
      },

      // 4. peer_support_request (English)
      {
        docId: 'tmpl_peer_support_req',
        key: 'peer_support_request',
        locale: 'en',
        name: 'Peer Support Request Notification',
        subject: 'New Peer Support Request: <%= caseNumber %> (<%= caseTitle %>)',
        senderName: 'My Case Buddy Peer Directory',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'Dear <%= proName %>,\n\n<%= lipName %> has requested your peer legal support on <%= caseTitle %> (<%= caseNumber %>).\n\nReview: <%= actionUrl %>',
        bodyHtml: wrapEmailHtml(
          'Peer Support Request',
          'Peer Support',
          'Someone has requested your help',
          'UK Family Court &bull; Practice Direction 27A',
          `<p>Dear <strong><%= proName %></strong>,</p>
           <p><strong><%= lipName %></strong> chose your profile from the verified directory seeking legal peer support on <strong><%= caseTitle %></strong> (Ref: <%= caseNumber %>).</p>
           <div style="margin:20px 0;padding:16px;background-color:#f8fafc;border-radius:10px;border-left:4px solid ${BRAND_STYLE.primary};">
             <em>&ldquo;<%= helpNote %>&rdquo;</em>
           </div>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="${BRAND_STYLE.primary}" style="border-radius:12px;background-color:${BRAND_STYLE.primary};">
                 <a href="<%= actionUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Review Request &rarr;</a>
               </td>
             </tr>
           </table>`
        ),
      },

      // 5. peer_support_accepted (English)
      {
        docId: 'tmpl_peer_support_acc',
        key: 'peer_support_accepted',
        locale: 'en',
        name: 'Peer Support Accepted Notification',
        subject: 'Peer Supporter Assigned: <%= supporterName %> joined <%= caseTitle %>',
        senderName: 'My Case Buddy Support',
        senderEmail: 'support@mycasebuddy.justice.gov.uk',
        bodyText: 'Dear <%= lipName %>,\n\n<%= supporterName %> (<%= supporterRole %>) has accepted your peer support request on <%= caseTitle %>.',
        bodyHtml: wrapEmailHtml(
          'Peer Supporter Assigned',
          'Supporter Assigned',
          'A supporter has joined your case',
          '<%= supporterName %> has accepted your peer support request.',
          `<p>Dear <strong><%= lipName %></strong>,</p>
           <p>Great news! <strong><%= supporterName %></strong> (<strong><%= supporterRole %></strong>) has agreed to support your family court matter <strong><%= caseTitle %></strong>.</p>
           <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
             <tr>
               <td align="center" bgcolor="#0e7a55" style="border-radius:12px;background-color:#0e7a55;">
                 <a href="<%= caseUrl %>" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Open Case Workspace &rarr;</a>
               </td>
             </tr>
           </table>`
        ),
      },
    ];

    for (const t of templates) {
      await executeSql(ctx, `
        INSERT INTO email_templates (
          document_id, template_key, locale, name, subject, body_html, body_text, sender_name, sender_email, active, created_at, updated_at, published_at
        ) VALUES (
          ${sqlStr(t.docId)},
          ${sqlStr(t.key)},
          ${sqlStr(t.locale)},
          ${sqlStr(t.name)},
          ${sqlStr(t.subject)},
          ${sqlStr(t.bodyHtml)},
          ${sqlStr(t.bodyText)},
          ${sqlStr(t.senderName)},
          ${sqlStr(t.senderEmail)},
          TRUE,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (template_key, locale) DO UPDATE SET
          name = EXCLUDED.name,
          subject = EXCLUDED.subject,
          body_html = EXCLUDED.body_html,
          body_text = EXCLUDED.body_text,
          sender_name = EXCLUDED.sender_name,
          sender_email = EXCLUDED.sender_email,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }
  },

  /**
   * Rollback migration
   */
  async down(ctx) {
    // 1. Revert built-in users-permissions email templates
    const defaultUsersPermEmail = JSON.stringify({
      reset_password: {
        display: 'Email.template.reset_password',
        icon: 'sync',
        options: {
          from: { name: 'Administration Panel', email: 'no-reply@strapi.io' },
          response_email: '',
          object: 'Reset password',
          message: '<p>We heard that you lost your password. Sorry about that!</p>\n\n<p>But don’t worry! You can use the following link to reset your password:</p>\n<p><%= URL %>?code=<%= TOKEN %></p>\n\n<p>Thanks.</p>',
        },
      },
      email_confirmation: {
        display: 'Email.template.email_confirmation',
        icon: 'check-square',
        options: {
          from: { name: 'Administration Panel', email: 'no-reply@strapi.io' },
          response_email: '',
          object: 'Account confirmation',
          message: '<p>Thank you for registering!</p>\n\n<p>You have to confirm your email address. Please click on the link below.</p>\n\n<p><%= URL %>?confirmation=<%= CODE %></p>\n\n<p>Thanks.</p>',
        },
      },
    });

    await executeSql(ctx, `
      UPDATE strapi_core_store_settings
      SET value = ${sqlStr(defaultUsersPermEmail)}
      WHERE key = 'plugin_users-permissions_email';
    `);

    // 2. Clean up permissions
    await executeSql(ctx, `
      DO $$
      DECLARE
        p_id INT;
        act TEXT;
        actions TEXT[] := ARRAY[
          'api::email-template.email-template.find',
          'api::email-template.email-template.findOne'
        ];
      BEGIN
        FOREACH act IN ARRAY actions LOOP
          SELECT id INTO p_id FROM up_permissions WHERE action = act LIMIT 1;
          IF p_id IS NOT NULL THEN
            DELETE FROM up_permissions_role_lnk WHERE permission_id = p_id;
            DELETE FROM up_permissions WHERE id = p_id;
          END IF;
        END LOOP;
      END $$;
    `);

    // 3. Drop table
    await executeSql(ctx, `
      DROP TABLE IF EXISTS email_templates CASCADE;
    `);
  },
};
