import { button, detailsCard, esc, paragraph, quote, renderEmail } from '../../../utils/email-layout';
import { SUPPORT_EMAIL } from '../../config/app-config';
import type { EmailContent, EmailTemplate } from './email-template';

const CONFIDENTIALITY_NOTE =
  '<strong>FPR Part 12 &amp; PD 27A:</strong> family proceedings are confidential. Information shared through My Case Buddy is for giving lay assistance only and must not be passed on without the court&rsquo;s permission.';

export interface PeerSupportCaseSummary {
  caseNumber: string;
  caseTitle: string;
  court: string;
  caseType: string;
  stage: string;
}

export interface PeerSupportRequestData extends PeerSupportCaseSummary {
  proName: string;
  lipName: string;
  lipEmail: string;
  helpNote: string;
  actionUrl: string;
  frontendUrl: string;
}

/** Sent to the legal supporter a litigant chose from the directory. */
export class PeerSupportRequestEmail implements EmailTemplate<PeerSupportRequestData> {
  render(d: PeerSupportRequestData): EmailContent {
    return {
      subject: `[My Case Buddy] New Peer Support Request: ${d.caseNumber} (${d.caseTitle})`,
      text: `Dear ${d.proName},\n\n${d.lipName} (${d.lipEmail}) has requested your peer legal support on case ${d.caseNumber} (${d.caseTitle}).\n\nHelp Requested:\n"${d.helpNote}"\n\nPlease log in to My Case Buddy to respond: ${d.frontendUrl}/peer-directory\n\nRegards,\nMy Case Buddy Support`,
      html: renderEmail({
        title: `New peer support request: ${d.caseNumber}`,
        preheader: `${d.lipName} has asked for your help with a family court case.`,
        tone: 'brand',
        eyebrow: 'Peer support request',
        icon: '&#129309;',
        heroTitle: 'Someone has asked for your help',
        heroSubtitle: 'UK Family Court &bull; Practice Direction 27A',
        bodyHtml: [
          paragraph(`Dear <strong style="color:#0f172a;">${esc(d.proName)}</strong>,`),
          paragraph(
            `<strong style="color:#0f172a;">${esc(d.lipName)}</strong> (<a href="mailto:${esc(d.lipEmail)}" style="color:#2b4acb;">${esc(d.lipEmail)}</a>) chose your profile in the verified legal directory and would like your help with their family court case.`
          ),
          detailsCard('Case summary', [
            { label: 'Case', value: d.caseTitle },
            { label: 'Reference', value: d.caseNumber },
            { label: 'Court', value: d.court },
            { label: 'Case type', value: d.caseType },
            { label: 'Stage', value: d.stage },
          ]),
          quote(d.helpNote, 'brand', 'What they need help with'),
          button(d.actionUrl, 'Review and respond'),
        ].join('\n'),
        smallPrint: CONFIDENTIALITY_NOTE,
        supportEmail: SUPPORT_EMAIL,
      }),
    };
  }
}

export interface PeerSupportConfirmationData {
  lipName: string;
  proName: string;
  proRole: string;
  proFirm: string;
  proRegistration: string;
  caseTitle: string;
  caseNumber: string;
  helpNote: string;
  frontendUrl: string;
}

/** Copy sent to the litigant confirming who their request went to. */
export class PeerSupportConfirmationEmail implements EmailTemplate<PeerSupportConfirmationData> {
  render(d: PeerSupportConfirmationData): EmailContent {
    return {
      subject: `[My Case Buddy] Peer Support Request Sent: ${d.proName} (${d.proRole})`,
      text: `Dear ${d.lipName},\n\nYour peer support request for case ${d.caseNumber} (${d.caseTitle}) has been sent to ${d.proName} (${d.proRole}).\n\nHelp Requested: "${d.helpNote}"\n\nYou will be notified when they respond.\n\nRegards,\nMy Case Buddy Support`,
      html: renderEmail({
        title: 'Your peer support request was sent',
        preheader: `Your request has been sent to ${d.proName}.`,
        tone: 'success',
        eyebrow: 'Request sent',
        icon: '&#10003;',
        heroTitle: 'Your request is on its way',
        heroSubtitle: `We have sent it to ${esc(d.proName)}.`,
        bodyHtml: [
          paragraph(`Dear <strong style="color:#0f172a;">${esc(d.lipName)}</strong>,`),
          paragraph(
            `Your request for help with <strong style="color:#0f172a;">${esc(d.caseTitle)}</strong> (reference <strong style="color:#0f172a;">${esc(d.caseNumber)}</strong>) has been sent to:`
          ),
          detailsCard('Legal supporter', [
            { label: 'Name', value: d.proName },
            { label: 'Role', value: d.proRole },
            { label: 'Firm', value: d.proFirm },
            { label: 'Registration', value: d.proRegistration },
          ]),
          quote(d.helpNote, 'success', 'Your message'),
          paragraph(
            `We have emailed ${esc(d.proName)} and added a note to your case timeline. When they accept or get in touch, you will see it on your dashboard.`
          ),
          button(`${d.frontendUrl}/`, 'Go to my dashboard', 'success'),
        ].join('\n'),
        smallPrint: '<strong>Privilege notice:</strong> your request is made under Practice Direction 27A guidance for litigants in person.',
        supportEmail: SUPPORT_EMAIL,
      }),
    };
  }
}

export interface PeerSupportAcceptedData {
  ownerName: string;
  proName: string;
  proRole: string;
  proEmail: string;
  caseTitle?: string | null;
  caseNumber?: string | null;
  court?: string | null;
  caseUrl: string;
}

/** Sent to the case owner when a supporter joins (via the open request or an invite). */
export class PeerSupportAcceptedEmail implements EmailTemplate<PeerSupportAcceptedData> {
  render(d: PeerSupportAcceptedData): EmailContent {
    return {
      subject: `[My Case Buddy] Peer Support Request Accepted: ${d.caseNumber || d.caseTitle} (${d.proName})`,
      html: renderEmail({
        title: 'Your peer support request was accepted',
        preheader: `${d.proName} has accepted your request and joined your case.`,
        tone: 'success',
        eyebrow: 'Good news',
        icon: '&#129309;',
        heroTitle: 'Your request has been accepted',
        heroSubtitle: `${esc(d.proName)} has joined your case team.`,
        bodyHtml: [
          paragraph(`Dear <strong style="color:#0f172a;">${esc(d.ownerName)}</strong>,`),
          paragraph(
            `<strong style="color:#0f172a;">${esc(d.proName)}</strong> (<a href="mailto:${esc(d.proEmail)}" style="color:#0e7a55;">${esc(d.proEmail)}</a>) has accepted your peer support request and can now help with your case.`
          ),
          detailsCard('Case and supporter', [
            { label: 'Case', value: d.caseTitle || 'Family Court Matter' },
            { label: 'Reference', value: d.caseNumber || 'N/A' },
            { label: 'Supporter', value: `${d.proName} (${d.proRole})` },
            { label: 'Supporter email', value: d.proEmail },
            { label: 'Court', value: d.court || 'Family Court' },
          ]),
          button(d.caseUrl, 'View my case', 'success'),
        ].join('\n'),
        smallPrint:
          '<strong>FPR Part 12 &amp; PD 27A:</strong> family proceedings are confidential. Your supporter has accepted the confidentiality terms of the Family Procedure Rules.',
        supportEmail: SUPPORT_EMAIL,
      }),
    };
  }
}
