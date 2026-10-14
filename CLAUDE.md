@AGENTS.md

# ReachOut

Last updated 2026-10-14. This file is the handoff from the conversation where the project was built. Treat it as the source of truth for state and decisions; `ARCHITECTURE.md` has the longer design reasoning and `README.md` the user-facing overview.

## What this is

A product that drafts a tailored LinkedIn message to a recruiter, grounded in the user's real CV, and keeps a record of everyone they contacted. The owner (Feyisayo Salami, Lagos) is job-hunting for AI Automation Engineer roles and uses it for their own search; it is also a portfolio piece.

Three parts: a **web app** (accounts, CV profile, outreach dashboard, device keys), a **Chrome MV3 side-panel extension** (reads the LinkedIn page being viewed, requests a draft), and **API routes** (drafting, keys). The extension is a thin client: the CV and history live in the account, the extension holds only a revocable device key.

**Product principle, do not break:** the user always reviews and sends every message. No auto-send, no LinkedIn search, no crawling, no bulk collection. It only reads the single page the user has open. That is both the LinkedIn terms position and the reason their account stays safe.

## Stack

Next.js 16 App Router (Turbopack), React 19, Tailwind 3, Firebase Auth + Firestore (client SDK 13, Admin SDK 14), Anthropic SDK (`claude-haiku-4-5-20251001`), `pdfjs-dist` and `mammoth` in the browser for CV text, Vercel hosting. `package.json` has `"type": "module"`.

**Next 16 differs from older versions.** Read the matching guide in `node_modules/next/dist/docs/` before using an API (route handler `params` is a Promise, for example). Install packages with `--ignore-scripts`.

Firebase over Supabase because Supabase's free tier pauses projects after about 7 days idle, which breaks a tool used in bursts. No file storage: only CV **text** is stored (parsed in the browser), which avoids Firebase Storage's paid-plan dependency and keeps less sensitive data at rest.

## Accounts and identities (these have each caused a failure)

| Thing | Value / rule |
|---|---|
| GitHub | `Feyisayo-Pro/reachout`, private, branch `main`. Run `gh auth switch --user Feyisayo-Pro` before pushing. The active account silently reverts to `DTO-Sapphire` between sessions; a push once failed with "repository not found" because of it. |
| Git author | `Feyisayo Salami <peterfeyisayo16@gmail.com>`, passed per commit with `git -c user.name=... -c user.email=...`. The global default is wrong (`Dev-Feyisayo`) and silently blocks Vercel Hobby deploys. Do not edit git config. |
| Firebase | Project `reachout-5720c`, owned by **feyilive@gmail.com**. The Firebase CLI must be logged in as that account (`npx firebase-tools login:list`) or deploys fail with HTTP 403. Firestore in `eur3`. Email/Password auth enabled. Rules deployed. |
| Vercel | Project `reachout` under `peterfeyisayo16-8612s-projects`. Production URL `https://reachout-seven-alpha.vercel.app/`. |
| Not this project | `useapply-me` is a separate product. Never put ReachOut code or branches there, and never choose a repo or account the user has not named. |

## State

- **Phase 1** (accounts, profile, CV upload and parse, save): built and **confirmed working by the user** against real Firebase.
- **Phase 2** (device keys, `/api/draft`, `/api/me`, `/api/keys`, outreach dashboard, Settings page, thin extension): code complete, **deployed to production on 2026-10-14**. Verified on the live URL: unauthenticated and bad-key calls return clean 401s, a fake `ro_` key triggers a real Firestore read with the production service account, a garbage ID token is rejected by `firebase-admin/auth`, CORS allows only `chrome-extension://`. **Not yet run end to end by a signed-in user** (create key, extension, real draft).
- **Deployed:** production serves Phase 2. Vercel production env has `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` and `ANTHROPIC_API_KEY`. The service-account JSON has been loaded and deleted from disk (regenerate one in the Firebase console if it is ever needed again).
- **Platform constraint (caused the first prod 500s):** Vercel starts Next.js functions with `--no-experimental-require-module`, so `require()` of an ESM-only package fails. `firebase-admin@14` pulls `jwks-rsa@4`, which requires `jose@6` (ESM-only), and every API route died at module load with `ERR_REQUIRE_ESM`. `package.json` therefore has `"overrides": {"jwks-rsa": "3.2.2"}` (jose 4, has a CJS build). `jwks-rsa` is only used by `firebase-admin` for App Check, not ID-token verification. Remove the override once `firebase-admin` or Vercel no longer needs it, and re-test on a preview. To reproduce locally: `node --no-experimental-require-module node_modules/next/dist/bin/next start`.
- **Draft length:** the 300-character connection-note limit (LinkedIn counts characters, not words) is enforced server-side in `lib/fit.js`. The model cannot count, so an over-long draft is sent back with its exact length, at most 3 model calls per request; if it still does not fit the API returns 422 and saves nothing. An over-limit draft is never returned or stored. The prompt asks for at most 3 sentences, aiming for 240-280 characters.
- **Tests:** `npm test` (`node --test`) covers `lib/fit.js` only. Key generation, hashing, CORS allow/deny cases and error non-leakage in `lib/server.js` were checked with a throwaway script that was not saved; a `node:test` suite for them is still worthwhile. The prompt's effect on real drafts can only be judged live.

## Next steps, in order

1. ~~Load the service account key~~ Done 2026-10-14 (script: `./scripts/push-service-account.sh <json>`; it pipes values to Vercel and `.env.local` without printing them, then delete the JSON, which is a permanent admin credential).
2. ~~`vercel deploy --prod`~~ Done 2026-10-14. Use a preview deploy plus `vercel curl` to test changes first. `vercel curl` creates a Deployment Protection bypass token on the project; revoke it afterwards (Project Settings, Deployment Protection).
3. Reload the extension at `chrome://extensions`, then test the whole loop: site Settings, create a key, paste URL and key into the extension, "Save & check connection", draft on a recruiter's profile, confirm the row appears under Outreach.
4. **Rotate the Anthropic key.** A key was pasted into a chat on 2026-10-12 and must be treated as burned. Confirm the one in Vercel is a Console `sk-ant-api03-` key with billing credit.
5. Then roadmap items below.

## Roadmap and known gaps

- Notes editing in the dashboard (rules already allow `notes`), follow-up reminders, pagination past 100 rows.
- **Open decision:** data retention and a delete-my-account path that purges everything. Also whether this is ever multi-user, and whether to use a custom domain.
- Optional: the original design let the user upload a recruiter's LinkedIn "Save to PDF" export for richer context (full About, experience, the roles they say they hire for). The new draft endpoint dropped it; it could return as `recruiterProfileText`.
- `firestore.rules` still contains a stale `match /deviceKeys/{id}` under `users/{uid}`. Device keys are now a top-level collection, denied by the catch-all. Harmless; tidy when next deploying rules.
- Email verification only nags, it does not block.
- `npm audit` shows 7 transitive advisories (`@grpc/grpc-js`, `sprintf-js`) via `firebase-admin`. Not force-fixed because that would downgrade it.
- Extension icons are generated solid-colour placeholders.

## Security invariants (do not regress)

- Device keys are stored only as a sha256 hash; the document ID **is** the hash (`deviceKeys/{hash}`), so the draft endpoint resolves a key with one direct get. The raw key is shown once. Max 5 active per user; revocation is immediate.
- Clients can never read or write `deviceKeys`. `outreach` rows are created only by the server (`allow create: if false`); an owner may edit only `status`, `notes` and `sentAt`. Every path is scoped to `request.auth.uid`; the default is deny.
- `lib/admin.js` and `lib/server.js` are server-only. Never import them from client code.
- CORS is granted only to `chrome-extension://` origins, never `*`.
- Only deliberate errors below 500 reach clients; everything else is logged and returned as "Something went wrong."
- Scraped recruiter text is untrusted. The system prompt tells the model never to follow instructions inside it. Keep that line.
- Work authorisation comes only from the user's own profile field. The model must never infer it, and must never state anything about the candidate that is not in their CV.
- Secrets: `.env.local` and service-account JSON files are gitignored. Push secrets via stdin or interactive prompts, never as command-line arguments, and never echo them.
- **Do not run `git add -A` blindly.** A service-account key was sitting untracked in the repo root and would have been committed. Read `git status` and add explicit paths.

## LinkedIn extraction (the fragile part)

LinkedIn ships **build-hashed CSS classes** (`gflkzy`, `gflkxo`, ...) that change every deploy, renders **no `<h1>`** on profiles, strips `og:` meta tags when logged in, and emits **no JSON-LD**. Class-based selectors die within days, so `extension/content.js` anchors on things that survive:

| Field | Source |
|---|---|
| name | `document.title`, minus the `(3)` unread prefix and ` \| LinkedIn` |
| headline | nearest ancestor of the name element holding real content lines. The name element sits **outside `<main>`**, so scan `body`. |
| location | the literal **Contact info** link, which sits beside it |
| company | `@ Company` in the headline, else the Experience section |
| about | the literal **About** heading, walking up to its section |

Verified on **one profile only**. Not yet tested: hiring **posts** (`getPost` is a guess), profiles with no `@ Company` in the headline, and non-English LinkedIn UI (the heading text is English-only). When a field breaks, use `tools/linkedin-dom/` in the DevTools console; do not add class selectors.

## Working with this user

- Be concise and professional; they have asked not to burn tokens. Say plainly what is verified and what is not.
- Ask before choosing a repo, account, or destructive action. They were unhappy when a repo was assumed.
- Their global rules in `~/.claude/CLAUDE.md` apply: list security decisions for anything touching auth, credentials, uploads or personal data, give reasons plus alternatives for stack choices, and find the root cause before changing code.
- Some steps only they can do: Google and Firebase console actions, browser consent screens, rotating keys. Say so rather than attempting a workaround.

## Layout

```
app/                 pages (login, signup, profile, settings, dashboard) and api/{draft,keys,me}
components/          AppShell (auth guard), AuthForm
lib/                 firebase.js (client), admin.js + server.js (server only), api.js, parseCV.js
extension/           MV3 side panel: content.js, background.js, sidepanel.{html,js}
tools/linkedin-dom/  DevTools console diagnostics
scripts/             push-service-account.sh
firestore.rules      deployed with: npx firebase-tools deploy --only firestore:rules --project reachout-5720c
```

Commands: `npm run dev` (localhost:3000), `npm run build`.
