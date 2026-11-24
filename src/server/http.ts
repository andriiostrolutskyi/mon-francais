import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { ZodType } from "zod";
import type { AppEnvironment } from "./types";

export function fail(status: 400 | 401 | 403 | 404 | 409 | 503, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}
export async function jsonInput<T>(context: Context<AppEnvironment>, schema: ZodType<T>) {
  let raw: unknown;
  try { raw = await context.req.json(); } catch { fail(400, "This request contains invalid JSON."); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Check this request and try again.");
  return parsed.data;
}

export function isConflict(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed|FOREIGN KEY constraint failed|NOT NULL constraint failed: generation_requests.status/iu.test(error.message);
}
