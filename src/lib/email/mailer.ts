import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import { AppConfig } from '../config/app-config';
import type { EmailContent } from './templates/email-template';

interface StrapiEmailService {
  send(options: Record<string, unknown>): Promise<unknown>;
}

export interface OutgoingEmail extends EmailContent {
  to: string;
  replyTo?: string;
  /** Display name for the From header, e.g. "My Case Buddy". */
  senderName: string;
}

/** Thin wrapper over the Strapi email plugin: one place for sender formatting and availability. */
export class Mailer extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  /** False when the email plugin is not installed/configured; callers then skip sending. */
  isAvailable(): boolean {
    return Boolean(this.emailService());
  }

  fromAddress(): string {
    return AppConfig.fromEmail();
  }

  async send(email: OutgoingEmail): Promise<void> {
    const service = this.emailService();
    if (!service) return;
    await service.send({
      from: `"${email.senderName}" <${this.fromAddress()}>`,
      ...(email.replyTo !== undefined ? { replyTo: email.replyTo } : {}),
      to: email.to,
      subject: email.subject,
      ...(email.text !== undefined ? { text: email.text } : {}),
      html: email.html,
    });
  }

  private emailService(): StrapiEmailService | undefined {
    return this.strapi.plugin('email')?.service('email') as StrapiEmailService | undefined;
  }
}
