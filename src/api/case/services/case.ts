import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::case.case', ({ strapi }) => ({
  /**
   * Find cases accessible to a specific user (SOLID - SRP & DIP)
   * Restricts results to cases where the user is owner.
   */
  async findForUser(userId: number | string, queryParams: Record<string, unknown> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const populateConfig = (queryParams.populate as any) || {
      parties: true,
      hearings: true,
      orders: true,
      documents: true,
      notes: true,
      deadlines: true,
    };

    return strapi.documents('api::case.case').findMany({
      ...queryParams,
      filters: {
        $or: [
          { owner: { id: { $eq: userId } } },
        ],
      },
      populate: populateConfig,
    });
  },

  /**
   * Check whether a user is the owner of a given case
   */
  async isUserCaseOwner(caseDocumentId: string, userId: number | string): Promise<boolean> {
    const caseRecord = await strapi.documents('api::case.case').findOne({
      documentId: caseDocumentId,
      populate: { owner: true },
    });

    if (!caseRecord || !caseRecord.owner) {
      return false;
    }

    return String(caseRecord.owner.id) === String(userId);
  },
}));
