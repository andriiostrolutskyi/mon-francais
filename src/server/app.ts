import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { scheduler } from "../learning/scheduler";
import { fail, isConflict } from "./http";
import { getUser } from "./store";
import { authenticate } from "./auth";
import { vocabularyRoutes } from "./vocabulary";
import { collectionRoutes } from "./collections";
import { reviewRoutes } from "./reviews";
import { readingRoutes } from "./readings";
import { audioRoutes } from "./audio";
import { progressRoutes } from "./progress";
import type { AppEnvironment } from "./types";

const app = new Hono<AppEnvironment>();

app.use("/api/*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});
app.use("/api/*", authenticate);
app.use("/api/*", async (context, next) => {
  const missing = (["OPENAI_API_KEY", "SPEECHIFY_API_KEY"] as const).filter((key) => !context.env[key]?.trim());
  if (missing.length) fail(503, `Set ${missing.join(" and ")} in .dev.vars or your Cloudflare Worker secrets.`);
  await next();
});
app.get("/api/health", async (context) => {
  await context.env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  return context.json({ status: "ok", database: "connected", scheduler: { algorithm: "FSRS-6", desiredRetention: scheduler.parameters.request_retention } });
});
app.get("/api/workspace", async (context) => {
  const { id, name, timezone } = await getUser(context.env.DB, context.get("learnerId"));
  return context.json({ learner: { id, name, timezone } });
});
app.route("/api/vocabulary", vocabularyRoutes);
app.route("/api/collections", collectionRoutes);
app.route("/api/reviews", reviewRoutes);
app.route("/api/learning", readingRoutes);
app.route("/api/learning", audioRoutes);
app.route("/api/learning", progressRoutes);

app.notFound(() => fail(404, "Not found."));
app.onError((error, context) => error instanceof HTTPException ? error.getResponse()
  : isConflict(error)
    ? context.json({ error: "Learning data changed in another tab. Refresh and try again." }, 409)
    : context.json({ error: error.name === "TimeoutError" ? "AI took too long to respond. Please try again."
      : "The workspace could not complete this request. Please try again." }, 503));

export default app;
