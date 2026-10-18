import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';

/**
 * Writes the owner / member link rows directly, so relational queries that run immediately
 * after a create or join see the relation even before Strapi's own sync completes.
 * Failures are logged and swallowed: the Document Service write remains the source of truth.
 */
export class CaseLinkRepository extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  async ensureOwnerLink(caseDocumentId: string, userId: number): Promise<void> {
    try {
      const caseRecord = (await this.strapi.db.query('api::case.case').findOne({
        where: { documentId: caseDocumentId },
      })) as { id?: number } | null;
      if (!caseRecord?.id || !userId) return;

      const existing = await this.strapi.db
        .connection('cases_owner_lnk')
        .where({ case_id: caseRecord.id, user_id: userId })
        .first();
      if (!existing) {
        await this.strapi.db.connection('cases_owner_lnk').insert({ case_id: caseRecord.id, user_id: userId });
      }
    } catch (linkErr) {
      this.log.warn('Could not auto-link case owner in cases_owner_lnk:', linkErr);
    }
  }

  /** @param logPrefix keeps the original per-feature log tag (e.g. "[AcceptInvite]"). */
  async ensureMemberLink(caseId: number | undefined, userId: number | undefined, logPrefix: string): Promise<void> {
    try {
      if (!caseId || !userId) return;
      const existing = await this.strapi.db.connection.raw('SELECT 1 FROM cases_members_lnk WHERE case_id = ? AND user_id = ?', [
        caseId,
        userId,
      ]);
      const rows = existing?.rows || existing || [];
      if (rows.length === 0) {
        await this.strapi.db.connection.raw('INSERT INTO cases_members_lnk (case_id, user_id, user_ord) VALUES (?, ?, ?)', [
          caseId,
          userId,
          1,
        ]);
      }
    } catch (lnkErr) {
      this.log.warn(`${logPrefix} ${lnkErr}`);
    }
  }
}
