# Mon Français

A French study app with vocabulary lists, spaced-repetition flashcards, and AI-generated readings, quizzes, and writing feedback.

## Run locally

Requires Node.js 24.

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Open http://127.0.0.1:5173. Add your own provider credentials to `.dev.vars` to generate study material and audio. These features send the relevant study text to the configured providers.

## Deploy to Cloudflare

1. Run `npx wrangler login`. Copy `wrangler.jsonc` to the ignored `wrangler.local.jsonc`. Set the D1 database name and ID and the private R2 bucket name in the copy. [Create a D1 database](https://developers.cloudflare.com/d1/get-started/) · [Create an R2 bucket](https://developers.cloudflare.com/r2/get-started/)
2. Protect the Worker hostname with Cloudflare Access and allow your learners' email addresses. Create an ignored `.env.production` with `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `LEARNERS_JSON`, and the provider credentials from `.dev.vars.example`. Use the Access team URL and application audience tag. If using Workers AI for text, set `USE_ADVANCED_MODELS` to `"false"` in the private Wrangler config. [Cloudflare Access setup](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

   ```dotenv
   LEARNERS_JSON='{"friend":{"email":"friend@example.com","name":"Friend","timezone":"Europe/Paris"}}'
   ```

   Add one entry per learner. IDs use lowercase letters, digits, hyphens, and underscores. Keep existing IDs when upgrading so learners keep their study history. New profiles are created on first use, with UTC as the default timezone.

3. Apply migrations and deploy.

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.local.jsonc
   CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=wrangler.local.jsonc npm run deploy -- --secrets-file .env.production
   ```
