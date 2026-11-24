import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type AppEnvironment = {
  Bindings: {
    DB: D1Database; AUDIO: R2Bucket;
    ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; LEARNERS_JSON?: string; DEV_LEARNER_ID?: string;
    USE_ADVANCED_MODELS?: string; CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_AI_TOKEN?: string; OPENAI_API_KEY?: string; SPEECHIFY_API_KEY?: string; GOOGLE_TTS_API_KEY?: string;
  };
  Variables: { learnerId: string };
};
