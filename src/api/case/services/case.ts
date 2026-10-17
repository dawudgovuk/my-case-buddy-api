import { factories, type Modules } from '@strapi/strapi';
import { FULL_CASE_POPULATE } from '../../../lib/cases/case-populate';
import { CaseChildrenSynchronizer } from '../../../lib/cases/children/case-children-synchronizer';
import { isNumericId, sameUser, type AppUser, type CaseRecord, type EntityId } from '../../../lib/domain/models';
import { isProfessionalRole } from '../../../lib/domain/roles';
import { UserRepository } from '../../../lib/users/user-repository';

type CaseFilter = Record<string, unknown>;
type FindManyParams = Modules.Documents.ServiceParams<'api::case.case'>['findMany'];

export default factories.createCoreService('api::case.case', ({ strapi }) => {
  const users = new UserRepository(strapi);
  const children = new CaseChildrenSynchronizer(strapi);

  async function loadCase(documentId: string, populate: Record<string, boolean>): Promise<CaseRecord | null> {
    return (await strapi.documents('api::case.case').findOne({ documentId, populate })) as unknown as CaseRecord | null;
  }

  /** Filters matching cases the user owns or is a member of, by numeric id and/or documentId. */
  function ownershipFilters(userId: EntityId, userDocId: string | undefined): CaseFilter[] {
    const isNum = isNumericId(userId);
    return [
      ...(userDocId ? [{ owner: { documentId: { $eq: userDocId } } }] : []),
      { owner: { documentId: { $eq: String(userId) } } },
      ...(isNum ? [{ owner: { id: { $eq: Number(userId) } } }] : []),
      ...(userDocId ? [{ members: { documentId: { $eq: userDocId } } }] : []),
      { members: { documentId: { $eq: String(userId) } } },
      ...(isNum ? [{ members: { id: { $eq: Number(userId) } } }] : []),
    ];
  }

  return {
    /**
     * Cases accessible to a user: those they own or are a member of, plus — for legal
     * professionals — every case currently seeking peer support.
     */
    async findForUser(userId: EntityId, queryParams: Record<string, unknown> = {}, userRecord?: Partial<AppUser>) {
      const populate = queryParams.populate || FULL_CASE_POPULATE;

      const userRole = userRecord?.userRole || (await users.findById(userId))?.userRole;
      let userDocId = userRecord?.documentId;
      if (!userDocId && isNumericId(userId)) {
        userDocId = (await users.findById(Number(userId)))?.documentId;
      }

      const orFilters = ownershipFilters(userId, userDocId);
      if (isProfessionalRole(userRole)) {
        orFilters.push({ seekingPeerSupport: { $eq: true } });
      }

      const { filters: extraFilters, ...restParams } = queryParams as { filters?: CaseFilter } & Record<string, unknown>;
      const params = {
        ...restParams,
        filters: extraFilters ? { $and: [extraFilters, { $or: orFilters }] } : { $or: orFilters },
        populate,
      };
      return strapi.documents('api::case.case').findMany(params as FindManyParams);
    },

    /** Resolves a route id that may be a documentId or a caseNumber to the documentId. */
    async resolveDocumentId(idOrCaseNumber: string): Promise<string | null> {
      if (!idOrCaseNumber) return null;
      try {
        const byDocId = await strapi.documents('api::case.case').findOne({ documentId: idOrCaseNumber });
        if (byDocId?.documentId) return byDocId.documentId;

        const byCaseNumber = await strapi.documents('api::case.case').findFirst({
          filters: { caseNumber: { $eq: idOrCaseNumber } },
        });
        if (byCaseNumber?.documentId) return byCaseNumber.documentId;
      } catch {
        return null;
      }
      return null;
    },

    /** True when the user owns the case. A case without an owner (e.g. seeded demo data) is open. */
    async isUserCaseOwner(caseDocumentId: string, userId: EntityId): Promise<boolean> {
      const resolvedDocId = (await this.resolveDocumentId(caseDocumentId)) || caseDocumentId;
      const caseRecord = await loadCase(resolvedDocId, { owner: true });
      if (!caseRecord) return false;
      if (!caseRecord.owner) return true;
      return sameUser(caseRecord.owner, userId);
    },

    /**
     * True when the user may access the case: owner, member, a legal professional while the case
     * is seeking peer support, or anyone when the case has neither owner nor members.
     */
    async isUserCaseMember(caseDocumentId: string, userId: EntityId): Promise<boolean> {
      const resolvedDocId = (await this.resolveDocumentId(caseDocumentId)) || caseDocumentId;
      const caseRecord = await loadCase(resolvedDocId, { owner: true, members: true });
      if (!caseRecord) return false;

      if (!caseRecord.owner && (!caseRecord.members || caseRecord.members.length === 0)) return true;

      if (caseRecord.seekingPeerSupport) {
        const user = await users.findById(userId);
        if (isProfessionalRole(user?.userRole)) return true;
      }

      if (caseRecord.owner && sameUser(caseRecord.owner, userId)) return true;
      return Array.isArray(caseRecord.members) ? caseRecord.members.some((m) => sameUser(m, userId)) : false;
    },

    /** Upserts / prunes the child records (parties, hearings, …) sent with a case. */
    async syncCaseChildren(caseDocId: string, payload: Record<string, unknown>): Promise<void> {
      await children.sync(caseDocId, payload);
    },
  };
});
