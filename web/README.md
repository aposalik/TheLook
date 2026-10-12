# TheLook web application

The Next.js application lives in this directory. Project overview, architecture, setup, privacy notes, and contribution workflow are documented in the [repository README](../README.md).

## Development

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Use `MOCK=1` in `.env.local` for credit-free UI development. Never commit `.env.local` or expose API credentials in browser code.

## Hosted Supabase Auth setup

1. Add the Project URL and **publishable** key to `web/.env.local` using `.env.local.example`.
2. In Supabase Dashboard → Authentication → Providers, enable Anonymous and Email. Require email confirmation for permanent email accounts.
3. Configure Google in Supabase and its Google OAuth client, then allow `/auth/callback` for local and deployed application URLs.
4. Add `http://localhost:3000/auth/callback` and the production callback URL under Authentication URL configuration.
5. Optionally create a free Cloudflare Turnstile widget, put only its site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and configure the Turnstile secret directly in Supabase Auth CAPTCHA settings.

Guests receive an anonymous Supabase identity automatically. Before switching to a permanent account, the UI warns that guest data will not transfer. Browser data is temporarily scoped by user ID until Phases C/D move files and metadata to hosted Storage/Postgres.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
