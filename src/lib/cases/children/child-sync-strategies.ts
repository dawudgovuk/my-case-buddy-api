/**
 * How each kind of case child record (party, hearing, …) is cleaned and synchronised.
 * Every strategy shares one interface, so the synchroniser treats them uniformly
 * (Open/Closed: add a record type by adding a strategy, not by editing the synchroniser).
 */
export type ChildPayloadKey = 'parties' | 'hearings' | 'orders' | 'documents' | 'notes' | 'deadlines';

export type ChildUid =
  | 'api::party.party'
  | 'api::hearing.hearing'
  | 'api::order.order'
  | 'api::document.document'
  | 'api::case-note.case-note'
  | 'api::document-deadline.document-deadline';

export type ChildData = Record<string, unknown>;

export interface ChildSyncStrategy {
  /** Key of the array in the case payload. */
  readonly key: ChildPayloadKey;
  readonly uid: ChildUid;
  /** Delete existing records that are missing from the incoming list. */
  readonly prunesMissing: boolean;
  toData(raw: ChildData, caseDocumentId: string): ChildData;
  /** Whether a new record (no documentId) may be created from this data. */
  canCreate(data: ChildData): boolean;
}

abstract class BaseChildStrategy implements ChildSyncStrategy {
  abstract readonly key: ChildPayloadKey;
  abstract readonly uid: ChildUid;
  readonly prunesMissing: boolean = false;

  abstract toData(raw: ChildData, caseDocumentId: string): ChildData;

  canCreate(_data: ChildData): boolean {
    return true;
  }

  protected today(): string {
    return new Date().toISOString().split('T')[0];
  }
}

class PartyStrategy extends BaseChildStrategy {
  readonly key = 'parties';
  readonly uid = 'api::party.party';
  override readonly prunesMissing = true;

  toData(p: ChildData, caseDocumentId: string): ChildData {
    const firstName = String(p.firstName || '').trim();
    const lastName = String(p.lastName || '').trim() || firstName;
    return {
      role: p.role || 'Applicant',
      firstName,
      lastName,
      dateOfBirth: p.dateOfBirth || undefined,
      address: p.address || undefined,
      solicitorFirm: p.solicitorFirm || undefined,
      solicitorContact: p.solicitorContact || undefined,
      contactEmail: p.contactEmail || undefined,
      contactPhone: p.contactPhone || undefined,
      representation: p.representation || undefined,
      parentalResponsibility: typeof p.parentalResponsibility === 'boolean' ? p.parentalResponsibility : undefined,
      schoolOrNursery: p.schoolOrNursery || undefined,
      specialMeasuresRequired: p.specialMeasuresRequired || undefined,
      case: caseDocumentId,
    };
  }

  override canCreate(data: ChildData): boolean {
    return Boolean(data.firstName && data.lastName);
  }
}

class HearingStrategy extends BaseChildStrategy {
  readonly key = 'hearings';
  readonly uid = 'api::hearing.hearing';
  override readonly prunesMissing = true;

  toData(h: ChildData, caseDocumentId: string): ChildData {
    return {
      type: h.type || 'Case Management',
      date: h.date || this.today(),
      time: h.time || undefined,
      location: h.location || undefined,
      judge: h.judge || undefined,
      notes: h.notes || undefined,
      outcome: h.outcome || undefined,
      outcomeSummary: h.outcomeSummary || undefined,
      remotePlatform: h.remotePlatform || undefined,
      remoteLink: h.remoteLink || undefined,
      specialMeasures: h.specialMeasures || undefined,
      case: caseDocumentId,
    };
  }
}

class OrderStrategy extends BaseChildStrategy {
  readonly key = 'orders';
  readonly uid = 'api::order.order';
  override readonly prunesMissing = true;

  toData(o: ChildData, caseDocumentId: string): ChildData {
    return {
      type: o.type || 'Other',
      dateMade: o.dateMade || this.today(),
      summary: String(o.summary || 'Court order'),
      expiresOn: o.expiresOn || undefined,
      documentUrl: o.documentUrl || undefined,
      hasPenalNotice: Boolean(o.hasPenalNotice),
      warningNotice: o.warningNotice || undefined,
      complianceDeadlines: Array.isArray(o.complianceDeadlines) ? o.complianceDeadlines : undefined,
      case: caseDocumentId,
    };
  }
}

class DocumentStrategy extends BaseChildStrategy {
  readonly key = 'documents';
  readonly uid = 'api::document.document';

  toData(d: ChildData, caseDocumentId: string): ChildData {
    return {
      title: String(d.title || 'Untitled Document'),
      type: d.type || 'Other',
      url: String(d.url || 'https://placeholder.invalid'),
      uploadedAt: d.uploadedAt || new Date().toISOString(),
      notes: d.notes || undefined,
      fileName: d.fileName || undefined,
      fileSize: typeof d.fileSize === 'number' ? d.fileSize : undefined,
      mimeType: d.mimeType || undefined,
      status: d.status || 'Draft',
      pageCount: typeof d.pageCount === 'number' ? d.pageCount : undefined,
      exhibitRef: d.exhibitRef || undefined,
      case: caseDocumentId,
    };
  }
}

class NoteStrategy extends BaseChildStrategy {
  readonly key = 'notes';
  readonly uid = 'api::case-note.case-note';

  toData(n: ChildData, caseDocumentId: string): ChildData {
    return {
      author: String(n.author || 'Author'),
      text: String(n.text || ''),
      category: n.category || undefined,
      case: caseDocumentId,
    };
  }

  override canCreate(data: ChildData): boolean {
    return Boolean(data.text);
  }
}

class DeadlineStrategy extends BaseChildStrategy {
  readonly key = 'deadlines';
  readonly uid = 'api::document-deadline.document-deadline';

  toData(dl: ChildData, caseDocumentId: string): ChildData {
    return {
      title: String(dl.title || 'Document Deadline'),
      description: dl.description || undefined,
      deadlineDate: dl.deadlineDate || this.today(),
      documentType: dl.documentType || undefined,
      status: dl.status || 'pending',
      submittedAt: dl.submittedAt || undefined,
      case: caseDocumentId,
    };
  }
}

/** Default strategies, in the order records are synchronised. */
export const DEFAULT_CHILD_STRATEGIES: readonly ChildSyncStrategy[] = [
  new PartyStrategy(),
  new HearingStrategy(),
  new OrderStrategy(),
  new DocumentStrategy(),
  new NoteStrategy(),
  new DeadlineStrategy(),
];
