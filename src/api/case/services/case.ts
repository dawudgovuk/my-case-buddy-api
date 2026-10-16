import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::case.case', ({ strapi }) => ({
  /**
   * Find cases accessible to a specific user (SOLID - SRP & DIP)
   * Restricts results to cases where the user is owner or an authorized collaborator/member.
   */
  /**
   * Find cases accessible to a specific user (SOLID - SRP & DIP)
   * Restricts results to cases where the user is owner or an authorized collaborator/member,
   * plus cases seeking peer support if the user is a verified legal professional.
   */
  async findForUser(
    userId: number | string,
    queryParams: Record<string, unknown> = {},
    userRecord?: { userRole?: string }
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const populateConfig = (queryParams.populate as any) || {
      parties: true,
      hearings: true,
      orders: true,
      documents: true,
      notes: true,
      deadlines: true,
      members: true,
      owner: true,
      invites: true,
    };

    let userRole = userRecord?.userRole;
    if (!userRole) {
      const isNumId = !isNaN(Number(userId));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u: any = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: isNumId ? { id: Number(userId) } : { documentId: String(userId) },
      });
      userRole = u?.userRole;
    }

    const isProfessional = ['McKenzieFriend', 'Solicitor', 'Barrister'].includes(userRole || '');

    const isNum = !isNaN(Number(userId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orFilters: any[] = [
      { owner: { documentId: { $eq: String(userId) } } },
      ...(isNum ? [{ owner: { id: { $eq: Number(userId) } } }] : []),
      { members: { documentId: { $eq: String(userId) } } },
      ...(isNum ? [{ members: { id: { $eq: Number(userId) } } }] : []),
    ];

    if (isProfessional) {
      orFilters.push({ seekingPeerSupport: { $eq: true } });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { filters: extraFilters, ...restParams } = queryParams as any;

    return strapi.documents('api::case.case').findMany({
      ...restParams,
      filters: extraFilters
        ? {
            $and: [
              extraFilters,
              { $or: orFilters },
            ],
          }
        : {
            $or: orFilters,
          },
      populate: populateConfig,
    });
  },

  /**
   * Resolves a case documentId by checking either documentId directly or caseNumber.
   */
  async resolveDocumentId(idOrCaseNumber: string): Promise<string | null> {
    if (!idOrCaseNumber) return null;

    try {
      // 1. Check direct documentId match
      const byDocId = await strapi.documents('api::case.case').findOne({
        documentId: idOrCaseNumber,
      });
      if (byDocId?.documentId) {
        return byDocId.documentId;
      }

      // 2. Check caseNumber match
      const byCaseNumber = await strapi.documents('api::case.case').findFirst({
        filters: { caseNumber: { $eq: idOrCaseNumber } },
      });
      if (byCaseNumber?.documentId) {
        return byCaseNumber.documentId;
      }
    } catch {
      return null;
    }

    return null;
  },

  /**
   * Check whether a user is the owner of a given case
   */
  async isUserCaseOwner(caseDocumentId: string, userId: number | string): Promise<boolean> {
    const resolvedDocId = (await this.resolveDocumentId(caseDocumentId)) || caseDocumentId;
    const caseRecord = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: { owner: true },
    });

    if (!caseRecord) {
      return false;
    }

    // If case has no owner assigned yet (e.g. seeded demo case), allow access
    if (!caseRecord.owner) {
      return true;
    }

    const userIdStr = String(userId);
    return (
      String(caseRecord.owner.id) === userIdStr ||
      Boolean(caseRecord.owner.documentId && String(caseRecord.owner.documentId) === userIdStr)
    );
  },

  /**
   * Check whether a user is either owner or an invited member of a given case (UK FPR Multi-Tenant Rule)
   */
  async isUserCaseMember(caseDocumentId: string, userId: number | string): Promise<boolean> {
    const resolvedDocId = (await this.resolveDocumentId(caseDocumentId)) || caseDocumentId;
    const caseRecord = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: { owner: true, members: true },
    });

    if (!caseRecord) {
      return false;
    }

    // If case has no owner assigned yet, allow access
    if (!caseRecord.owner && (!caseRecord.members || caseRecord.members.length === 0)) {
      return true;
    }

    // If case is actively seeking peer support, allow legal supporters to view
    if (caseRecord.seekingPeerSupport) {
      const isNumId = !isNaN(Number(userId));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u: any = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: isNumId ? { id: Number(userId) } : { documentId: String(userId) },
      });
      if (['McKenzieFriend', 'Solicitor', 'Barrister'].includes(u?.userRole || '')) {
        return true;
      }
    }

    const userIdStr = String(userId);
    if (
      caseRecord.owner &&
      (String(caseRecord.owner.id) === userIdStr ||
        Boolean(caseRecord.owner.documentId && String(caseRecord.owner.documentId) === userIdStr))
    ) {
      return true;
    }

    if (Array.isArray(caseRecord.members)) {
      return caseRecord.members.some(
        (m: { id?: number | string; documentId?: string }) =>
          String(m.id) === userIdStr || (m.documentId && String(m.documentId) === userIdStr)
      );
    }

    return false;
  },

  /**
   * High-performance parallel synchronization of child entities
   * (parties, hearings, orders, documents, notes, deadlines) into Strapi v5 collections.
   * Cleans up orphaned records and batches operations concurrently for maximum database throughput.
   */
  async syncCaseChildren(caseDocId: string, payload: Record<string, unknown>) {
    // Retrieve existing case relations for diffing and orphan pruning
    const existingCase = await strapi.documents('api::case.case').findOne({
      documentId: caseDocId,
      populate: {
        parties: true,
        hearings: true,
        orders: true,
        documents: true,
        notes: true,
        deadlines: true,
      },
    });

    const tasks: Promise<unknown>[] = [];

    // 1. Parties (Concurrent UPSERT + Prune)
    if (Array.isArray(payload.parties)) {
      const incomingDocIds = new Set<string>();

      payload.parties.forEach((p) => {
        if (typeof p === 'object' && p !== null) {
          const partyData = p as Record<string, unknown>;
          const docId = typeof partyData.documentId === 'string' && partyData.documentId.length > 0
            ? partyData.documentId
            : undefined;

          if (docId) incomingDocIds.add(docId);

          const firstName = String(partyData.firstName || '').trim();
          const lastName = String(partyData.lastName || '').trim() || firstName;

          const cleanData = {
            role: partyData.role || 'Applicant',
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: partyData.dateOfBirth || undefined,
            address: partyData.address || undefined,
            solicitorFirm: partyData.solicitorFirm || undefined,
            solicitorContact: partyData.solicitorContact || undefined,
            contactEmail: partyData.contactEmail || undefined,
            contactPhone: partyData.contactPhone || undefined,
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::party.party').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else if (cleanData.firstName && cleanData.lastName) {
            tasks.push(
              strapi.documents('api::party.party').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });

      // Prune deleted parties
      if (Array.isArray(existingCase?.parties)) {
        for (const existingParty of existingCase.parties) {
          const expDocId = (existingParty as { documentId?: string }).documentId;
          if (expDocId && !incomingDocIds.has(expDocId)) {
            tasks.push(strapi.documents('api::party.party').delete({ documentId: expDocId }));
          }
        }
      }
    }

    // 2. Hearings (Concurrent UPSERT + Prune)
    if (Array.isArray(payload.hearings)) {
      const incomingDocIds = new Set<string>();

      payload.hearings.forEach((h) => {
        if (typeof h === 'object' && h !== null) {
          const hData = h as Record<string, unknown>;
          const docId = typeof hData.documentId === 'string' && hData.documentId.length > 0
            ? hData.documentId
            : undefined;

          if (docId) incomingDocIds.add(docId);

          const cleanData = {
            type: hData.type || 'Case Management',
            date: hData.date || new Date().toISOString().split('T')[0],
            time: hData.time || undefined,
            location: hData.location || undefined,
            judge: hData.judge || undefined,
            notes: hData.notes || undefined,
            outcome: hData.outcome || undefined,
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::hearing.hearing').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else {
            tasks.push(
              strapi.documents('api::hearing.hearing').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });

      if (Array.isArray(existingCase?.hearings)) {
        for (const existingHearing of existingCase.hearings) {
          const exhDocId = (existingHearing as { documentId?: string }).documentId;
          if (exhDocId && !incomingDocIds.has(exhDocId)) {
            tasks.push(strapi.documents('api::hearing.hearing').delete({ documentId: exhDocId }));
          }
        }
      }
    }

    // 3. Orders (Concurrent UPSERT + Prune)
    if (Array.isArray(payload.orders)) {
      const incomingDocIds = new Set<string>();

      payload.orders.forEach((o) => {
        if (typeof o === 'object' && o !== null) {
          const oData = o as Record<string, unknown>;
          const docId = typeof oData.documentId === 'string' && oData.documentId.length > 0
            ? oData.documentId
            : undefined;

          if (docId) incomingDocIds.add(docId);

          const cleanData = {
            type: oData.type || 'Other',
            dateMade: oData.dateMade || new Date().toISOString().split('T')[0],
            summary: String(oData.summary || 'Court order'),
            expiresOn: oData.expiresOn || undefined,
            documentUrl: oData.documentUrl || undefined,
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::order.order').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else {
            tasks.push(
              strapi.documents('api::order.order').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });

      if (Array.isArray(existingCase?.orders)) {
        for (const existingOrder of existingCase.orders) {
          const exoDocId = (existingOrder as { documentId?: string }).documentId;
          if (exoDocId && !incomingDocIds.has(exoDocId)) {
            tasks.push(strapi.documents('api::order.order').delete({ documentId: exoDocId }));
          }
        }
      }
    }

    // 4. Documents (Concurrent UPSERT)
    if (Array.isArray(payload.documents)) {
      payload.documents.forEach((d) => {
        if (typeof d === 'object' && d !== null) {
          const dData = d as Record<string, unknown>;
          const docId = typeof dData.documentId === 'string' && dData.documentId.length > 0
            ? dData.documentId
            : undefined;

          const cleanData = {
            title: String(dData.title || 'Untitled Document'),
            type: dData.type || 'Other',
            url: String(dData.url || 'https://placeholder.invalid'),
            uploadedAt: dData.uploadedAt || new Date().toISOString(),
            notes: dData.notes || undefined,
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::document.document').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else {
            tasks.push(
              strapi.documents('api::document.document').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });
    }

    // 5. Notes (Concurrent UPSERT)
    if (Array.isArray(payload.notes)) {
      payload.notes.forEach((n) => {
        if (typeof n === 'object' && n !== null) {
          const nData = n as Record<string, unknown>;
          const docId = typeof nData.documentId === 'string' && nData.documentId.length > 0
            ? nData.documentId
            : undefined;

          const cleanData = {
            author: String(nData.author || 'Author'),
            text: String(nData.text || ''),
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::case-note.case-note').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else if (cleanData.text) {
            tasks.push(
              strapi.documents('api::case-note.case-note').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });
    }

    // 6. Deadlines (Concurrent UPSERT)
    if (Array.isArray(payload.deadlines)) {
      payload.deadlines.forEach((dl) => {
        if (typeof dl === 'object' && dl !== null) {
          const dlData = dl as Record<string, unknown>;
          const docId = typeof dlData.documentId === 'string' && dlData.documentId.length > 0
            ? dlData.documentId
            : undefined;

          const cleanData = {
            title: String(dlData.title || 'Document Deadline'),
            description: dlData.description || undefined,
            deadlineDate: dlData.deadlineDate || new Date().toISOString().split('T')[0],
            documentType: dlData.documentType || undefined,
            status: dlData.status || 'pending',
            submittedAt: dlData.submittedAt || undefined,
            case: caseDocId,
          };

          if (docId) {
            tasks.push(
              strapi.documents('api::document-deadline.document-deadline').update({
                documentId: docId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          } else {
            tasks.push(
              strapi.documents('api::document-deadline.document-deadline').create({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: cleanData as any,
              })
            );
          }
        }
      });
    }

    // Execute all relational persistence concurrently
    await Promise.all(tasks);
  },
}));
