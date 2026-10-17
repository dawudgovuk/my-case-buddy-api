import type { Core } from '@strapi/strapi';
import { StrapiService } from '../../core/strapi-service';
import { DEFAULT_CHILD_STRATEGIES, type ChildData, type ChildSyncStrategy, type ChildUid } from './child-sync-strategies';

/** Minimal Document Service surface used for child records of any type. */
interface ChildDocuments {
  create(params: { data: ChildData }): Promise<unknown>;
  update(params: { documentId: string; data: ChildData }): Promise<unknown>;
  delete(params: { documentId: string }): Promise<unknown>;
}

function documentIdOf(item: ChildData): string | undefined {
  return typeof item.documentId === 'string' && item.documentId.length > 0 ? item.documentId : undefined;
}

/**
 * Applies the child arrays of a case payload (parties, hearings, …): updates records that carry a
 * documentId, creates new ones, and prunes missing ones where the strategy says so.
 * All writes run concurrently.
 */
export class CaseChildrenSynchronizer extends StrapiService {
  constructor(
    strapi: Core.Strapi,
    private readonly strategies: readonly ChildSyncStrategy[] = DEFAULT_CHILD_STRATEGIES
  ) {
    super(strapi);
  }

  async sync(caseDocumentId: string, payload: Record<string, unknown>): Promise<void> {
    const existingCase = (await this.strapi.documents('api::case.case').findOne({
      documentId: caseDocumentId,
      populate: { parties: true, hearings: true, orders: true, documents: true, notes: true, deadlines: true },
    })) as unknown as Record<string, unknown> | null;

    const tasks: Promise<unknown>[] = [];
    for (const strategy of this.strategies) {
      const incoming = payload[strategy.key];
      if (Array.isArray(incoming)) {
        tasks.push(...this.planWrites(strategy, incoming, existingCase?.[strategy.key], caseDocumentId));
      }
    }
    await Promise.all(tasks);
  }

  private documents(uid: ChildUid): ChildDocuments {
    return this.strapi.documents(uid) as unknown as ChildDocuments;
  }

  private planWrites(strategy: ChildSyncStrategy, incoming: unknown[], existing: unknown, caseDocumentId: string): Promise<unknown>[] {
    const docs = this.documents(strategy.uid);
    const tasks: Promise<unknown>[] = [];
    const keptIds = new Set<string>();

    for (const raw of incoming) {
      if (typeof raw !== 'object' || raw === null) continue;
      const item = raw as ChildData;
      const documentId = documentIdOf(item);
      if (documentId) keptIds.add(documentId);
      const data = strategy.toData(item, caseDocumentId);

      if (documentId) {
        tasks.push(docs.update({ documentId, data }));
      } else if (strategy.canCreate(data)) {
        tasks.push(docs.create({ data }));
      }
    }

    if (strategy.prunesMissing && Array.isArray(existing)) {
      for (const record of existing as Array<{ documentId?: string }>) {
        if (record.documentId && !keptIds.has(record.documentId)) {
          tasks.push(docs.delete({ documentId: record.documentId }));
        }
      }
    }
    return tasks;
  }
}
