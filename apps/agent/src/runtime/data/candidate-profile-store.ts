import type { CandidateProfileDraft } from "../cv/candidate-profile";
import type { ModelUsageRecord } from "../models/usage";

export type CandidateProfileRecord = {
  id: string;
  status: "PENDING_REVIEW" | "CONFIRMED";
  profile: CandidateProfileDraft;
  embeddingText: string;
  embedding: number[];
  usage: ModelUsageRecord[];
};

export interface CandidateProfileStore {
  saveDraft(record: CandidateProfileRecord): Promise<void>;
  getById(id: string): Promise<CandidateProfileRecord | null>;
}

export class InMemoryCandidateProfileStore
  implements CandidateProfileStore
{
  private readonly records = new Map<string, CandidateProfileRecord>();

  async saveDraft(record: CandidateProfileRecord) {
    this.records.set(record.id, structuredClone(record));
  }

  async getById(id: string) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  }
}

export const candidateProfileStore = new InMemoryCandidateProfileStore();
