import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import { AppConfig } from '../config/app-config';
import type { AppUser, CaseRecord } from '../domain/models';
import { Mailer } from '../email/mailer';
import { TemplateService } from '../email/template-service';
import { PeerSupportAcceptedEmail } from '../email/templates/peer-support-templates';
import { CaseAuditLog } from './case-audit-log';
import { CaseLinkRepository } from './case-link-repository';

const SENDER_NAME = 'My Case Buddy Legal Support';

/**
 * Adds a legal supporter to a case. Shared by "accept peer support" and "accept invite".
 * Each flow calls the steps in its own order, with its own log prefix.
 */
export class CaseMembership extends StrapiService {
  private readonly links: CaseLinkRepository;
  private readonly audit: CaseAuditLog;
  private readonly mailer: Mailer;
  private readonly templates: TemplateService;

  constructor(strapi: Core.Strapi) {
    super(strapi);
    this.links = new CaseLinkRepository(strapi);
    this.audit = new CaseAuditLog(strapi);
    this.mailer = new Mailer(strapi);
    this.templates = new TemplateService(strapi);
  }

  /** Connects the user as a member, clears the peer support flag and ensures the link row exists. */
  async addSupporter(caseRecord: CaseRecord, userId: number, linkLogPrefix: string): Promise<void> {
    await this.strapi.documents('api::case.case').update({
      documentId: caseRecord.documentId,
      data: { members: { connect: [userId] }, seekingPeerSupport: false },
    });
    await this.links.ensureMemberLink(caseRecord.id, userId, linkLogPrefix);
  }

  /** Writes the audit note and emails the case owner (email is best-effort). */
  async announceSupporter(caseRecord: CaseRecord, supporter: AppUser, proName: string, proRole: string, logPrefix: string): Promise<void> {
    await this.audit.addNote(caseRecord.documentId, `${proName} (${proRole})`, `Accepted peer support request and joined case as ${proRole}.`);
    await this.notifyOwner(caseRecord, supporter, proName, proRole, logPrefix);
  }

  private async notifyOwner(caseRecord: CaseRecord, supporter: AppUser, proName: string, proRole: string, logPrefix: string): Promise<void> {
    try {
      const owner = caseRecord.owner;
      if (!this.mailer.isAvailable() || !owner?.email) return;
      const rendered = await this.templates.renderTemplate('peer_support_accepted', {
        ownerName: owner.name || owner.username || 'Litigant in Person',
        proName,
        proRole,
        proEmail: supporter.email || '',
        caseTitle: caseRecord.title,
        caseNumber: caseRecord.caseNumber,
        court: caseRecord.court,
        caseUrl: `${AppConfig.frontendUrl()}/cases/${caseRecord.documentId}`,
      }, 'en');
      await this.mailer.send({
        senderName: rendered.senderName || SENDER_NAME,
        to: owner.email,
        replyTo: supporter.email || undefined,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      this.log.info(`${logPrefix} Dispatched acceptance notification email to LIP ${owner.email}`);
    } catch (emailErr) {
      this.log.error(`${logPrefix} Failed to dispatch acceptance email: ${emailErr}`);
    }
  }
}
