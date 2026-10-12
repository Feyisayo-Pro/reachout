# ReachOut

Drafts a tailored LinkedIn outreach message to a recruiter, grounded in your real background. You review and send every message yourself.

A Chrome side panel reads the recruiter profile or hiring post you are already looking at, combines it with your stored background, and asks Claude for a short, specific message. Nothing is sent automatically.

## What it is not

It does not search LinkedIn, crawl profiles, collect data in bulk, or send messages. Automated search and messaging violate LinkedIn's User Agreement and get accounts restricted. Discovery stays manual: you browse LinkedIn normally, and ReachOut helps only with the drafting, on the single page in front of you.

## How it works

```
LinkedIn page you're viewing
        │  content.js reads the visible page
        ▼
  Side panel (extension)
        │  POST /api/draft  (bearer token)
        ▼
  Serverless API ──► Claude ──► draft
        │
        ▼
  You review, copy, and send it yourself
```

## Extraction notes

LinkedIn ships build-hashed CSS class names (`gflkzy`, `gflkxo`, …) that change on every deploy, renders no `<h1>` on profiles, strips `og:`/meta tags for logged-in views, and emits no JSON-LD. All of this was verified against a live profile. Class-based selectors therefore do not work for more than a few days.

`content.js` instead anchors on things that survive redeploys:

| Field | Source |
|---|---|
| name | `document.title`, minus the `(3)` unread prefix and the ` \| LinkedIn` suffix |
| headline | nearest ancestor of the name element holding real content lines |
| location | the literal **Contact info** link, which always sits beside the location |
| company | `@ Company` parsed from the headline, else the Experience section |
| about | the literal **About** heading, walking up to its section |

Note the name element sits **outside** `<main>`, so lookups scan the whole body.

This is still the most fragile part of the project, and it will eventually break. When it does, the fields come back empty rather than wrong.

## Setup

### 1. Deploy the API

```bash
npm install
npx vercel deploy
```

Set these environment variables on the deployment:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic key. Server-side only, never reaches the extension. |
| `TOKENS` | Comma-separated sha256 hashes of valid API tokens. |
| `DAILY_LIMIT` | Optional. Drafts per token per day (default 40). |

### 2. Create an API token

```bash
npm run token
```

Paste the **token** into the extension settings. Put the **hash** in `TOKENS`. The server never stores the token itself.

### 3. Load the extension

1. `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder
4. Open the side panel and fill in Settings: API base URL, token, and your background

## Usage

Open a recruiter's LinkedIn profile or a hiring post. Their details appear in the side panel. Choose connection note or direct message, optionally name the role, and click **Draft message**. Review it, copy it, send it yourself.

Connection notes are capped by LinkedIn at 300 characters; the panel shows a live count and flags drafts that run over.

## Safeguards in the prompt

The model is instructed never to invent experience, employers, dates, metrics, or skills, and never to claim work authorisation or location eligibility that was not stated. Where the candidate's background does not plausibly match the role, it is told to say so honestly rather than overstate fit. There is also a banned-phrase list to keep drafts from reading as generated.

These reduce the risk; they do not remove it. Read every draft before sending.

## Project layout

```
extension/      Chrome extension (Manifest V3, side panel)
  content.js    reads the current LinkedIn page
  background.js stores detected context
  sidepanel.*   UI, settings, draft display
api/            serverless endpoints
  draft.js      the drafting endpoint
  _lib/auth.js  token verification and daily limits
scripts/        token generator
```

## Status

Early. The extraction layer is verified against a live profile; the API and UI are untested end to end.
