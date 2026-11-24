# Mon Français

A French study app with vocabulary lists, spaced-repetition flashcards, and AI-generated readings, quizzes, and writing feedback.

## Run locally

Requires Node.js 24, an OpenAI API key, and a Speechify API key.

```sh
npm ci
cp -n .dev.vars.example .dev.vars
```

Set `OPENAI_API_KEY` (text) and `SPEECHIFY_API_KEY` (audio) in `.dev.vars`.

```sh
npm run db:migrate:local
npm run dev
```

Open http://127.0.0.1:5173. Generation sends the relevant study text to OpenAI or Speechify.

## Deploy to Cloudflare

1. Run `npx wrangler login`. Copy `wrangler.jsonc` to the ignored `wrangler.local.jsonc`. Set the D1 database name and ID and the private R2 bucket name in the copy. [Create a D1 database](https://developers.cloudflare.com/d1/get-started/) · [Create an R2 bucket](https://developers.cloudflare.com/r2/get-started/)
2. Protect the Worker hostname with Cloudflare Access and allow your learners' email addresses. Create an ignored `.env.production` with these settings. Use the Access team URL and application audience tag. [Cloudflare Access setup](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

   ```dotenv
   OPENAI_API_KEY=
   SPEECHIFY_API_KEY=
   ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
   ACCESS_AUD=your-application-audience
   LEARNERS_JSON='{"friend":{"email":"friend@example.com","name":"Friend","timezone":"Europe/Paris"}}'
   ```

   Add one entry per learner. Use lowercase IDs such as `friend` and keep existing IDs when upgrading to preserve study history. The default timezone is UTC.

3. Apply migrations and deploy.

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.local.jsonc
   CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=wrangler.local.jsonc npm run deploy -- --secrets-file .env.production
   ```
