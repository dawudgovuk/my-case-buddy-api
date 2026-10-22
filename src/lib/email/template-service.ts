import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import type { EmailContent } from './templates/email-template';
import {
  buildConfirmationHtml,
  buildVerificationHtml,
  RegistrationConfirmationEmail,
  VerificationEmail,
} from './templates/registration-templates';
import {
  PeerSupportRequestEmail,
  PeerSupportConfirmationEmail,
  PeerSupportAcceptedEmail,
  type PeerSupportRequestData,
  type PeerSupportConfirmationData,
  type PeerSupportAcceptedData,
} from './templates/peer-support-templates';

export interface EmailTemplateRecord {
  id: number;
  documentId: string;
  templateKey: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  active: boolean;
  locale?: string;
}

export interface RenderedEmailResult extends EmailContent {
  templateKey: string;
  locale: string;
  senderName: string;
  senderEmail: string;
  source: 'strapi_db' | 'code_fallback';
}

/**
 * Replaces both Lodash/EJS style `<%= var %>` and Mustache style `{{var}}` placeholders.
 * Resolves dot-notation (e.g. `user.email`) and case-insensitive keys (e.g. `USER.username`).
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  if (!template) return '';

  const resolveValue = (path: string): string => {
    const trimmed = path.trim();
    if (!trimmed) return '';

    // 1. Direct key match
    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
      const val = variables[trimmed];
      return val !== null && val !== undefined ? String(val) : '';
    }

    // 2. Case-insensitive key match on top-level
    const lowerKey = trimmed.toLowerCase();
    const matchedKey = Object.keys(variables).find((k) => k.toLowerCase() === lowerKey);
    if (matchedKey !== undefined) {
      const val = variables[matchedKey];
      return val !== null && val !== undefined ? String(val) : '';
    }

    // 3. Dot-notation traversal (e.g. USER.username or case.number)
    const parts = trimmed.split('.');
    let curr: unknown = variables;
    for (const part of parts) {
      if (curr === null || curr === undefined || typeof curr !== 'object') {
        curr = undefined;
        break;
      }
      const record = curr as Record<string, unknown>;
      if (part in record) {
        curr = record[part];
      } else {
        const pLower = part.toLowerCase();
        const foundKey = Object.keys(record).find((k) => k.toLowerCase() === pLower);
        curr = foundKey !== undefined ? record[foundKey] : undefined;
      }
    }

    if (curr !== undefined && curr !== null) {
      return String(curr);
    }

    return '';
  };

  // Replace <%= var %> and <%- var %>
  let result = template.replace(/<%[=-]?\s*([a-zA-Z0-9_.]+)\s*%>/g, (_, path) => resolveValue(path));
  // Replace {{var}} and {{{var}}}
  result = result.replace(/\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}\}/g, (_, path) => resolveValue(path));

  return result;
}

export class TemplateService extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  /**
   * Retrieves an EmailTemplate record from Strapi Documents, falling back to 'en' locale if missing.
   */
  async getTemplate(templateKey: string, locale = 'en'): Promise<EmailTemplateRecord | null> {
    try {
      const documentsService = this.strapi.documents('api::email-template.email-template');
      if (!documentsService) return null;

      // 1. Query for requested locale
      const requested = (await documentsService.findMany({
        locale,
        filters: {
          templateKey: { $eq: templateKey },
          active: { $eq: true },
        },
        limit: 1,
      })) as unknown as EmailTemplateRecord[];

      if (requested && requested.length > 0 && requested[0]) {
        return requested[0];
      }

      // 2. Fallback to English if requested was not 'en'
      if (locale !== 'en') {
        const enFallback = (await documentsService.findMany({
          locale: 'en',
          filters: {
            templateKey: { $eq: templateKey },
            active: { $eq: true },
          },
          limit: 1,
        })) as unknown as EmailTemplateRecord[];

        if (enFallback && enFallback.length > 0 && enFallback[0]) {
          return enFallback[0];
        }
      }

      // 3. Last fallback: any locale matching templateKey
      const anyFallback = (await documentsService.findMany({
        filters: {
          templateKey: { $eq: templateKey },
          active: { $eq: true },
        },
        limit: 1,
      })) as unknown as EmailTemplateRecord[];

      return anyFallback && anyFallback.length > 0 && anyFallback[0] ? anyFallback[0] : null;
    } catch (err: unknown) {
      this.log.warn(`[TemplateService] Could not fetch email template "${templateKey}" from Strapi: ${err}`);
      return null;
    }
  }

  /**
   * Renders an email template using Strapi database definitions if available,
   * otherwise falls back seamlessly to in-code templates.
   */
  async renderTemplate(
    templateKey: string,
    data: Record<string, unknown>,
    locale = 'en'
  ): Promise<RenderedEmailResult> {
    const template = await this.getTemplate(templateKey, locale);

    if (template && template.bodyHtml) {
      const subject = interpolateTemplate(template.subject || '', data);
      const html = interpolateTemplate(template.bodyHtml, data);
      const text = template.bodyText ? interpolateTemplate(template.bodyText, data) : undefined;
      const senderName = template.senderName || 'My Case Buddy';
      const senderEmail = template.senderEmail || 'support@mycasebuddy.justice.gov.uk';

      return {
        templateKey,
        locale: template.locale || locale,
        subject,
        html,
        text,
        senderName,
        senderEmail,
        source: 'strapi_db',
      };
    }

    // Fallback to in-code template rendering if not present in DB
    return this.renderFallback(templateKey, data, locale);
  }

  /**
   * In-code fallback generators for zero-downtime resilience.
   */
  private renderFallback(
    templateKey: string,
    data: Record<string, unknown>,
    locale = 'en'
  ): RenderedEmailResult {
    let content: EmailContent;
    let senderName = 'My Case Buddy';
    let senderEmail = 'support@mycasebuddy.justice.gov.uk';

    switch (templateKey) {
      case 'registration_confirmation': {
        const name = String(data.name || 'User');
        const email = String(data.email || '');
        const roleDisplayName = String(data.roleDisplayName || data.role || 'Litigant in Person');
        const referenceId = String(data.referenceId || 'MCB-REG');
        const nowFormatted = String(data.nowFormatted || new Date().toUTCString());
        const isLIP = Boolean(data.isLIP ?? data.role === 'LIP');

        content = new RegistrationConfirmationEmail().render({
          name,
          email,
          roleDisplayName,
          referenceId,
          nowFormatted,
          isLIP,
        });
        break;
      }

      case 'email_verification': {
        const name = String(data.name || 'User');
        const email = String(data.email || '');
        const roleDisplayName = String(data.roleDisplayName || data.role || 'Litigant in Person');
        const referenceId = String(data.referenceId || 'MCB-REG');
        const token = String(data.token || '');
        const verificationUrl = String(data.verificationUrl || '');
        const isLIP = Boolean(data.isLIP ?? data.role === 'LIP');

        senderName = 'My Case Buddy Safeguarding';
        senderEmail = 'safeguarding@mycasebuddy.justice.gov.uk';
        content = new VerificationEmail().render({
          name,
          email,
          roleDisplayName,
          referenceId,
          token,
          verificationUrl,
          isLIP,
        });
        break;
      }

      case 'peer_support_request': {
        content = new PeerSupportRequestEmail().render(data as unknown as PeerSupportRequestData);
        senderName = 'My Case Buddy Legal Support';
        break;
      }

      case 'peer_support_confirmation': {
        content = new PeerSupportConfirmationEmail().render(data as unknown as PeerSupportConfirmationData);
        senderName = 'My Case Buddy Legal Support';
        break;
      }

      case 'peer_support_accepted': {
        content = new PeerSupportAcceptedEmail().render(data as unknown as PeerSupportAcceptedData);
        senderName = 'My Case Buddy Legal Support';
        break;
      }

      default: {
        content = {
          subject: String(data.subject || `Notification from My Case Buddy`),
          html: `<p>${String(data.message || data.body || 'You have a new notification from My Case Buddy.')}</p>`,
          text: String(data.text || data.message || ''),
        };
      }
    }

    return {
      templateKey,
      locale,
      subject: content.subject,
      html: content.html,
      text: content.text,
      senderName,
      senderEmail,
      source: 'code_fallback',
    };
  }
}
