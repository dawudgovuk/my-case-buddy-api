import { renderEmail, esc, pill, paragraph, heading, detailsCard, checklist, note, button, linkFallback } from '../../../utils/email-layout';
import type { EmailContent, EmailTemplate } from './email-template';

/**
 * Builds a beautifully styled, responsive HTML email for Registration Confirmation & Remit Guide.
 */
export function buildConfirmationHtml(params: {
  name: string;
  email: string;
  roleDisplayName: string;
  referenceId: string;
  nowFormatted: string;
  isLIP?: boolean;
}): string {
  const { name, email, roleDisplayName, referenceId, nowFormatted, isLIP } = params;

  const guidanceTitle = isLIP
    ? '📜 Litigant in Person Guidance & Rights (HMCTS Family Court)'
    : '📜 McKenzie Friend Practice Guidance (July 2010)';

  const permittedList = isLIP
    ? [
        'Direct access to create and manage Family Court cases (Child Arrangements, Section 7 reports).',
        'Right to seek moral support and procedural reassurance from a McKenzie Friend.',
        'Compiling digital court bundles, chronological timelines, and position statements.',
        'Self-representing in court and directly addressing the bench during hearings.',
      ]
    : [
        'Providing moral support, encouragement, and calm reassurance to the litigant.',
        'Taking comprehensive in-court notes of evidence, submissions, and judge\'s directions.',
        'Quietly advising on procedural issues, practical questions, and witness examination.',
        'Assisting in organizing and managing the digital and paper trial bundles.',
      ];

  const prohibitedList = isLIP
    ? [
        'Must maintain strict confidentiality of all private family proceedings (FPR Rule 12.73).',
        'Cannot disclose child details or court documents to unauthorized third parties or social media.',
        'Cannot record hearings or court sessions without express judicial permission.',
        'Must comply with court-mandated filing deadlines and procedural directions.',
      ]
    : [
        'Cannot address the court directly or examine witnesses without special judicial leave.',
        'Cannot sign court pleadings, witness statements, or legal forms for the litigant.',
        'Cannot act as an authorized legal representative conducting litigation.',
        'Must maintain strict confidentiality of all private family proceedings (FPR Rule 12.73).',
      ];

  return renderEmail({
    title: 'Registration confirmed – My Case Buddy',
    preheader: `Welcome to My Case Buddy, ${name}. Your ${roleDisplayName} account is ready.`,
    tone: 'brand',
    eyebrow: 'Registration confirmed',
    icon: '&#9878;',
    heroTitle: `Welcome to My Case Buddy, ${esc(name)}`,
    heroSubtitle: `Your account as a <strong style="color:#ffffff;">${esc(roleDisplayName)}</strong> has been created.`,
    bodyHtml: [
      pill('&#10003; Application received', 'success'),
      paragraph(
        `Thank you for registering. Your profile has been created under reference <strong style="color:#0f172a;">${esc(referenceId)}</strong>. Keep this email for your records.`
      ),
      detailsCard('Your registration', [
        { label: 'Full name', value: name },
        { label: 'Email', value: email },
        { label: 'Role', value: roleDisplayName },
        { label: 'Reference', value: referenceId },
        { label: 'Registered', value: nowFormatted },
      ]),
      heading(esc(guidanceTitle)),
      checklist(permittedList.map(esc), 'tick', isLIP ? 'Your rights and what you can do' : 'What you can help with'),
      checklist(prohibitedList.map(esc), 'cross', isLIP ? 'Rules to follow' : 'What you must not do'),
      note(
        '<strong>One more step:</strong> we have sent you a second email with a link to confirm your email address. Please open it within 24 hours.',
        'warning'
      ),
    ].join('\n'),
    smallPrint: 'You are receiving this email because an account was created with this address on My Case Buddy.',
    supportEmail: 'support@mycasebuddy.justice.gov.uk',
  });
}

/**
 * Builds a beautifully styled, responsive HTML email for Account Verification with a prominent CTA button.
 */
export function buildVerificationHtml(params: {
  name: string;
  email: string;
  roleDisplayName: string;
  referenceId: string;
  token: string;
  verificationUrl: string;
  isLIP?: boolean;
}): string {
  const { name, email, roleDisplayName, referenceId, token, verificationUrl, isLIP } = params;

  const nextSteps = isLIP
    ? [
        'Your profile will be upgraded to <strong>Verified Litigant in Person</strong>.',
        'You can create and manage child arrangement cases, timelines, and court filings.',
        'You can invite verified McKenzie Friends for peer support and bundle organization.',
      ]
    : [
        `Your profile will be upgraded to <strong>Verified ${roleDisplayName}</strong>.`,
        'You will gain access to browse open peer support requests from Litigants in Person.',
        'You can view case milestones, court directions, and collaborative bundles.',
      ];

  return renderEmail({
    title: `Verify your ${roleDisplayName} account – My Case Buddy`,
    preheader: `Please confirm your email address to activate your ${roleDisplayName} account.`,
    tone: 'brand',
    eyebrow: isLIP ? 'Account verification' : 'Supporter verification',
    icon: '&#128737;',
    heroTitle: 'Confirm your email address',
    heroSubtitle: 'One click and your account is fully set up.',
    bodyHtml: [
      pill('Action required', 'warning'),
      paragraph(`Dear <strong style="color:#0f172a;">${esc(name)}</strong>,`),
      paragraph(
        isLIP
          ? 'To keep family court information safe, we ask everyone to confirm their email address before creating cases or asking a McKenzie Friend for help.'
          : 'To keep family court information safe, we ask every McKenzie Friend and legal supporter to confirm their email address before seeing cases or offering help.'
      ),
      button(verificationUrl, 'Verify my email address'),
      linkFallback(verificationUrl),
      checklist(nextSteps, 'number', 'What happens next'),
    ].join('\n'),
    smallPrint: `This link expires in 24 hours. Reference ${esc(referenceId)} &bull; Token ${esc(token)}.<br />If you didn't create this account, please contact <a href="mailto:safeguarding@mycasebuddy.justice.gov.uk" style="color:#64748b;">safeguarding@mycasebuddy.justice.gov.uk</a>.`,
    supportEmail: 'support@mycasebuddy.justice.gov.uk',
  });
}

export interface RegistrationEmailData {
  name: string;
  email: string;
  roleDisplayName: string;
  referenceId: string;
  isLIP: boolean;
}

/** Welcome email with the role guidance (registration confirmation). */
export class RegistrationConfirmationEmail implements EmailTemplate<RegistrationEmailData & { nowFormatted: string }> {
  render(d: RegistrationEmailData & { nowFormatted: string }): EmailContent {
    return {
      subject: `Registration Confirmed: Welcome to My Case Buddy (${d.roleDisplayName})`,
      text: d.isLIP
        ? `Dear ${d.name},\n\nThank you for registering as a Litigant in Person with My Case Buddy (Reference: ${d.referenceId}).\n\nYour profile has been created to help you manage Family Court proceedings, child arrangements, and hearings.\n\nA separate Verification Email has also been dispatched to your inbox. Please click the verification link to activate your account.\n\nWarm regards,\nThe My Case Buddy Team`
        : `Dear ${d.name},\n\nThank you for registering as a ${d.roleDisplayName} with My Case Buddy (Reference: ${d.referenceId}).\n\nUnder UK Family Procedure Rules (FPR) and Practice Guidance on McKenzie Friends (July 2010), your remit includes providing moral support, taking notes, and quietly advising the litigant.\n\nA separate Verification Email has also been dispatched to your inbox. Please click the verification link to activate your safeguarding clearance.\n\nWarm regards,\nThe My Case Buddy Team`,
      html: buildConfirmationHtml(d),
    };
  }
}

/** Email with the verification link. */
export class VerificationEmail implements EmailTemplate<RegistrationEmailData & { token: string; verificationUrl: string }> {
  render(d: RegistrationEmailData & { token: string; verificationUrl: string }): EmailContent {
    return {
      subject: `Action Required: Verify your ${d.roleDisplayName} account`,
      text: `Dear ${d.name},\n\nPlease confirm your email address to activate your ${d.roleDisplayName} profile on My Case Buddy.\n\nVerify Link: ${d.verificationUrl}\n\nThis verification link expires in 24 hours.\n\nRegards,\nSafeguarding & Governance Office`,
      html: buildVerificationHtml(d),
    };
  }
}
