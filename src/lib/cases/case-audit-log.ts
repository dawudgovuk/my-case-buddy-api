import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';

/** Appends notes to a case's timeline (requests for help, people joining, and so on). */
export class CaseAuditLog extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  async addNote(caseDocumentId: string, author: string, text: string): Promise<void> {
    await this.strapi.documents('api::case-note.case-note').create({
      data: { author, text, case: caseDocumentId },
    });
  }
}
