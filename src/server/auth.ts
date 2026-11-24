import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { Learner } from "../shared/learning";
import { fail } from "./http";
import { ensureUser } from "./store";
import type { AppEnvironment } from "./types";

const learnerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const timezoneSchema = z.string().trim().min(1).refine((timezone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
});
const learnersSchema = z.record(learnerIdSchema, z.object({
  email: emailSchema,
  name: z.string().trim().min(1),
  timezone: timezoneSchema.default("UTC"),
}));
const accessIssuerSchema = z.url({ protocol: /^https$/u }).transform((url) => new URL(url).origin);
let accessKeys: { issuer: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;

function accessLearners(value: string | undefined) {
  let json: unknown;
  try {
    json = JSON.parse(value ?? "{}");
  } catch {
    fail(503, "Configure LEARNERS_JSON with the invited learners.");
  }
  const parsed = learnersSchema.safeParse(json);
  if (!parsed.success) fail(503, "Configure LEARNERS_JSON with valid learner profiles.");
  const learners = Object.entries(parsed.data);
  if (learners.length === 0 || new Set(learners.map(([, profile]) => profile.email)).size !== learners.length) {
    fail(503, "Configure LEARNERS_JSON with a unique email address for each learner.");
  }
  return learners;
}

async function signedInLearner(env: AppEnvironment["Bindings"], token: string | undefined): Promise<Learner> {
  const issuer = accessIssuerSchema.safeParse(env.ACCESS_TEAM_DOMAIN);
  const audience = env.ACCESS_AUD?.trim();
  if (!issuer.success || !audience) fail(503, "Configure the Cloudflare Access team domain and audience.");
  if (!token) fail(401, "Sign in to your learning space.");
  const learners = accessLearners(env.LEARNERS_JSON);
  if (accessKeys?.issuer !== issuer.data) {
    accessKeys = { issuer: issuer.data, keys: createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer.data)) };
  }
  let email: string;
  try {
    const { payload } = await jwtVerify(token, accessKeys.keys, {
      algorithms: ["RS256"], issuer: issuer.data, audience, requiredClaims: ["exp", "sub", "email"],
    });
    email = emailSchema.parse(payload.email);
  } catch {
    fail(401, "Your sign-in has expired or is invalid. Sign in again.");
  }
  const learner = learners.find(([, profile]) => profile.email === email);
  if (!learner) fail(403, "This account does not have access to this learning space.");
  const [id, { name, timezone }] = learner;
  return { id, name, timezone };
}

function localLearner(value: string | undefined): Learner {
  const id = learnerIdSchema.safeParse(value?.trim() || "local");
  if (!id.success) fail(503, "Set DEV_LEARNER_ID to a lowercase learner ID in .dev.vars.");
  return { id: id.data, name: "Local learner", timezone: "UTC" };
}

export const authenticate = createMiddleware<AppEnvironment>(async (context, next) => {
  const learner = import.meta.env.DEV
    ? localLearner(context.env.DEV_LEARNER_ID)
    : await signedInLearner(context.env, context.req.header("Cf-Access-Jwt-Assertion"));
  if (!["GET", "HEAD"].includes(context.req.method) && context.req.header("Origin") !== new URL(context.req.url).origin) {
    fail(403, "This request must come from your learning space.");
  }
  await ensureUser(context.env.DB, learner);
  context.set("learnerId", learner.id);
  await next();
});
