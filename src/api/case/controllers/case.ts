import { factories } from '@strapi/strapi';
import { FULL_CASE_POPULATE } from '../../../lib/cases/case-populate';
import { CaseLinkRepository } from '../../../lib/cases/case-link-repository';
import { isAdmin, type AppUser } from '../../../lib/domain/models';
import type { UserRole } from '../../../lib/domain/roles';
import { RequestUserResolver } from '../../../lib/users/request-user-resolver';
import { UserRepository } from '../../../lib/users/user-repository';

type CaseBody = { data?: Record<string, unknown> } | undefined;

/** Splits child collections (synced separately) from the core case fields. */
function splitCasePayload(body: CaseBody) {
  const { parties, hearings, orders, documents, notes, deadlines, ...core } = body?.data ? { ...body.data } : {};
  return { core, children: { parties, hearings, orders, documents, notes, deadlines } };
}

export default factories.createCoreController('api::case.case', ({ strapi }) => {
  const resolver = new RequestUserResolver(new UserRepository(strapi));
  const links = new CaseLinkRepository(strapi);
  const cases = () => strapi.service('api::case.case');
  const peerSupport = () => strapi.service('api::case.peer-support');
  const resolveDocId = async (rawId: string) => (await cases().resolveDocumentId(rawId)) || rawId;
  const loadFullCase = (documentId: string) => strapi.documents('api::case.case').findOne({ documentId, populate: FULL_CASE_POPULATE });

  return {
    /** Creates a case owned by the caller, syncs its children and returns it fully populated. */
    async create(ctx) {
      const body = ctx.request.body as CaseBody;
      const { core, children } = splitCasePayload(body);
      const { ownerEmail, ...coreData } = core;

      const candidateEmail = (ownerEmail || resolver.headerEmail(ctx)) as string | undefined;
      const user = await resolver.resolveOrProvision(ctx, candidateEmail, ((coreData.userRole as UserRole) || 'LIP'));

      if (user && !coreData.owner) coreData.owner = user.documentId || user.id;
      if (body) body.data = coreData;

      const response = (await super.create(ctx)) as { data?: { documentId?: string } };
      const docId = response?.data?.documentId;
      if (!docId) return response;

      if (user) await links.ensureOwnerLink(docId, user.id);
      await cases().syncCaseChildren(docId, children);
      return { data: await loadFullCase(docId) };
    },

    /** Non-admin callers only see cases they own, belong to, or (professionals) can support. */
    async find(ctx) {
      const user = await resolver.resolve(ctx);
      if (user && !isAdmin(user)) {
        return { data: await cases().findForUser(user.id, ctx.query, user) };
      }
      return super.find(ctx);
    },

    async findOne(ctx) {
      const user = await resolver.resolve(ctx);
      const docId = await resolveDocId(ctx.params.id);

      if (user && !isAdmin(user) && docId && !(await cases().isUserCaseMember(docId, user.id))) {
        return ctx.forbidden('You do not have permission to view this case.');
      }
      if (docId) {
        const record = await loadFullCase(docId);
        if (record) return { data: record };
      }
      return super.findOne(ctx);
    },

    async update(ctx) {
      const user = ctx.state.user as AppUser | undefined;
      const docId = await resolveDocId(ctx.params.id);
      ctx.params.id = docId;

      if (user && !isAdmin(user) && docId && !(await cases().isUserCaseMember(docId, user.id))) {
        return ctx.forbidden('You do not have permission to update this case.');
      }

      const body = ctx.request.body as CaseBody;
      const { core, children } = splitCasePayload(body);
      if (body) body.data = core;

      await super.update(ctx);
      if (!docId) return super.update(ctx);

      await cases().syncCaseChildren(docId, children);
      return { data: await loadFullCase(docId) };
    },

    /** Only the case owner (or an admin) may delete a case. */
    async delete(ctx) {
      const user = ctx.state.user as AppUser | undefined;
      const docId = await resolveDocId(ctx.params.id);
      ctx.params.id = docId;

      if (user && !isAdmin(user) && docId && !(await cases().isUserCaseOwner(docId, user.id))) {
        return ctx.forbidden('Only the case owner or administrator may delete this case.');
      }
      return super.delete(ctx);
    },

    /** Verified legal professionals (Solicitor, Barrister, McKenzie Friend). */
    async findProfessionals(ctx) {
      try {
        return { data: await strapi.service('api::case.professional-directory').list() };
      } catch (err: unknown) {
        return ctx.badRequest(err instanceof Error ? err.message : 'Failed to fetch legal professionals');
      }
    },

    /** A litigant asks a legal professional for help on a case. */
    async requestPeerSupport(ctx) {
      const user = await resolver.resolve(ctx);
      const { targetUserId, note } = ctx.request.body as { targetUserId?: string; note?: string };
      const docId = await resolveDocId(ctx.params.id);
      if (!docId) return ctx.badRequest('Case ID is required');

      return peerSupport().request({ caseDocumentId: docId, user, headerEmail: resolver.headerEmail(ctx), targetUserId, note });
    },

    /** A legal professional accepts a peer support request and joins the case. */
    async acceptPeerSupport(ctx) {
      const result = await peerSupport().accept(ctx.params.id, await resolver.resolve(ctx));
      switch (result.status) {
        case 'unauthorized':
          return ctx.unauthorized(result.message);
        case 'forbidden':
          return ctx.forbidden(result.message);
        case 'not-found':
          return ctx.notFound(result.message);
        default:
          return ctx.send({
            success: true,
            case: result.caseRecord,
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name || result.user.username,
              role: result.user.userRole,
            },
          });
      }
    },
  };
});
