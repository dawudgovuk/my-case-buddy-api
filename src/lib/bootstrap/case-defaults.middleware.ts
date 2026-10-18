import type { Modules } from '@strapi/strapi';

type DocumentMiddleware = Modules.Documents.Middleware.Middleware;

/** e.g. FC-2026-84920 */
export function generateCaseNumber(now: Date = new Date()): string {
  return `FC-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
}

/** Fills in `caseNumber` and `startedAt` (today) when a case is created without them. */
export const caseDefaultsMiddleware: DocumentMiddleware = async (ctx, next) => {
  if (ctx.uid === 'api::case.case' && ctx.action === 'create') {
    const params = ctx.params as { data?: { caseNumber?: string; startedAt?: string } };
    if (params.data) {
      params.data.caseNumber ||= generateCaseNumber();
      params.data.startedAt ||= new Date().toISOString().split('T')[0];
    }
  }
  return next();
};
