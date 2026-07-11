This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Remaster Phase 1 (July 2026)

Key architecture (see `docs/superpowers/specs/2026-07-10-trace-remaster-design.md`):

- **All pose AI is on-device** (MediaPipe, self-hosted in `public/models/` + `public/mediapipe-wasm/`; `lite` model for scans, `full` for live practice). No server AI costs.
- **Zero-storage**: reference videos persist in the user's IndexedDB (`lib/videoStore.ts`); Supabase stores only metadata + choreo timelines (`scan_cache`).
- **Scan once, practice forever**: scans produce a beat-quantized `ChoreoTimeline` (`lib/choreoTimeline.ts`), cached in Supabase keyed by video identity + segment. **Requires migration `supabase/migrations/007_scan_cache.sql` — run it in the Supabase SQL editor.**
- **PWA**: service worker (`public/sw.js`) precaches models for offline practice. Bump `CACHE_VERSION` in `sw.js` when precached assets change. Regenerate icons with `node scripts/generate-icons.mjs`.
- Tests: `npm test` (Vitest, `lib/__tests__/`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

**Environment variables:** In Vercel → your project → **Settings → Environment Variables**, add (for Production and Preview):

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – your Supabase anon/public key  

If you use the waitlist API, also add:

- `SUPABASE_URL`  
- `SUPABASE_SERVICE_ROLE_KEY`  

Values are in [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/_/settings/api).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
