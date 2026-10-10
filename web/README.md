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

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
