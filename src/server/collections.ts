import { Hono } from "hono";
import { z } from "zod";
import { collectionInputSchema, normalizeTextKey } from "../shared/vocabulary";
import type { Collection } from "../shared/vocabulary";
import { fail, isConflict, jsonInput } from "./http";
import type { AppEnvironment } from "./types";

export const collectionRoutes = new Hono<AppEnvironment>();
collectionRoutes.get("/", async (context) => {
  const { results: collections } = await context.env.DB.prepare("SELECT id, name FROM collections WHERE user_id = ? ORDER BY name_key, id")
    .bind(context.get("learnerId")).all<Collection>();
  return context.json(collections);
});
collectionRoutes.put("/:id", async (context) => {
  const id = z.uuid().safeParse(context.req.param("id"));
  if (!id.success) fail(400, "Choose a valid list.");
  const { name } = await jsonInput(context, collectionInputSchema);
  try {
    const collection = await context.env.DB.prepare(`INSERT INTO collections (id, user_id, name, name_key) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key WHERE collections.user_id = excluded.user_id
      RETURNING id, name`).bind(id.data, context.get("learnerId"), name, normalizeTextKey(name)).first<Collection>();
    if (!collection) fail(404, "This list is unavailable.");
    return context.json(collection);
  } catch (cause) {
    if (isConflict(cause)) fail(409, "A list with this name already exists. Choose another name.");
    throw cause;
  }
});
collectionRoutes.delete("/:id", async (context) => {
  const db = context.env.DB;
  const userId = context.get("learnerId");
  await db.batch([
    db.prepare("DELETE FROM collections WHERE id = ? AND user_id = ?").bind(context.req.param("id"), userId),
    db.prepare("UPDATE users SET review_revision = review_revision + 1 WHERE id = ? AND changes() > 0").bind(userId),
  ]);
  return context.json({ removed: true });
});
