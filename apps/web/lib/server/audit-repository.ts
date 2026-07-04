import { desc } from "drizzle-orm";

import { createDatabase, type Database } from "./db";
import { auditLogs } from "./db/schema";

export type AuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type CreateAuditLogInput = Omit<AuditLog, "id" | "createdAt">;

export interface AuditRepository {
  appendAuditLog(input: CreateAuditLogInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

function mapAudit(row: typeof auditLogs.$inferSelect): AuditLog {
  return {
    ...row,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  };
}

export function createDrizzleAuditRepository(
  database: Database = createDatabase(),
): AuditRepository {
  return {
    async appendAuditLog(input) {
      const [row] = await database.insert(auditLogs).values(input).returning();
      if (!row) throw new Error("Audit insert returned no row.");
      return mapAudit(row);
    },
    async listAuditLogs() {
      const rows = await database
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt));
      return rows.map(mapAudit);
    },
  };
}

export function createInMemoryAuditRepository(): AuditRepository {
  const stored: AuditLog[] = [];
  return {
    async appendAuditLog(input) {
      const entry = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: Date.now(),
      };
      stored.push(entry);
      return entry;
    },
    async listAuditLogs() {
      return [...stored];
    },
  };
}
