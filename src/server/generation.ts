import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { fail } from "./http";

type GenerationKind = "vocabulary" | "reading" | "feedback";

export async function hash(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function reserveGeneration(db: D1Database, userId: string, kind: GenerationKind, id: string, input: unknown) {
  const now = Date.now();
  const lease = crypto.randomUUID();
  const inputHash = await hash(input);
  await db.prepare("UPDATE generation_requests SET status = 'failed' WHERE user_id = ? AND kind = ? AND status = 'running' AND started_at < ?")
    .bind(userId, kind, now - 120000).run();
  const existing = await db.prepare("SELECT status, input_hash, output_json FROM generation_requests WHERE id = ? AND user_id = ? AND kind = ?")
    .bind(id, userId, kind).first<{ status: string; input_hash: string; output_json: string | null }>();
  if (existing) {
    if (existing.input_hash !== inputHash) fail(409, "This request changed. Please try again.");
    if (existing.status === "complete") return { cached: true as const, data: JSON.parse(existing.output_json!) as unknown };
    if (existing.status === "running") fail(409, "Your request is still running. Give it a moment, then try again.");
  }
  const result = await db.prepare(`INSERT INTO generation_requests (id, user_id, kind, status, input_hash, lease, started_at)
    SELECT ?, ?, ?, 'running', ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM generation_requests WHERE user_id = ? AND kind = ? AND status = 'running')
    ON CONFLICT(id) DO UPDATE SET status = 'running', lease = excluded.lease, started_at = excluded.started_at
    WHERE generation_requests.user_id = excluded.user_id AND generation_requests.kind = excluded.kind
      AND generation_requests.input_hash = excluded.input_hash AND generation_requests.status = 'failed'`)
    .bind(id, userId, kind, inputHash, lease, now, userId, kind).run();
  if (!result.meta.changes) fail(409, "Another request is running. Please try again when it finishes.");
  return { cached: false as const, lease };
}
export async function generateOnce<T>(db: D1Database, userId: string, kind: GenerationKind, id: string, input: unknown,
  generate: () => Promise<{ output: T; statements: D1PreparedStatement[] }>): Promise<T> {
  const reserved = await reserveGeneration(db, userId, kind, id, input);
  if (reserved.cached) return reserved.data as T;
  try {
    const { output, statements } = await generate();
    await db.batch([
      // Fail the transaction if this attempt has expired or a retry owns the lease.
      db.prepare(`UPDATE generation_requests SET status = CASE WHEN status = 'running' AND lease = ? THEN 'complete' ELSE NULL END,
        output_json = ? WHERE id = ?`).bind(reserved.lease, JSON.stringify(output), id),
      ...statements,
    ]);
    return output;
  } catch (cause) {
    await db.prepare("UPDATE generation_requests SET status = 'failed' WHERE id = ? AND status = 'running' AND lease = ?")
      .bind(id, reserved.lease).run();
    throw cause;
  }
}
