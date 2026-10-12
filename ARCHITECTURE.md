# ReachOut — Architecture Plan

Status: **proposal, not built.** For review before any code is written.

## What ReachOut is

A product that helps you reach out to recruiters on LinkedIn with messages grounded in your real background, and keeps a record of everyone you have contacted.

Three parts:

1. **Web platform** — sign up, log in, upload your CV, manage your profile, see your outreach history.
2. **Chrome extension** — reads the recruiter profile or hiring post you are viewing, requests a draft, logs it to your account.
3. **API** — drafting, auth, and data access.

Discovery stays manual. You browse LinkedIn yourself; ReachOut never searches, crawls, bulk-collects, or sends. Every message is reviewed and sent by you.

---

## Stack decision

### Database, auth, storage: **Firebase**

**Why, and what was rejected:**

| Option | Verdict |
|---|---|
| **Firebase** | **Chosen.** Free Spark plan does not pause for inactivity. You already use it in three projects. Auth, database, and hosting in one service. |
| Supabase | Rejected on your criterion: free-tier projects pause after ~7 days idle and need a manual restore. Nicer SQL, but an unreliable tool is worse than a less elegant one. |
| Neon + Clerk | Postgres that auto-wakes transparently (unlike Supabase's hard pause), and better auth UX. Rejected as two services to wire and bill instead of one, and neither is already in your stack. |
| MongoDB Atlas M0 | Does not pause, but another unfamiliar service with no advantage here. |

**Verify before building:** confirm the current Firebase Spark limits yourself. These policies change and this document may be out of date.

### No file storage

We store the **text** of your CV, not the PDF.

The drafting only ever needs text. You already parse PDFs client-side with `pdfjs-dist` in `useapply-me`, so the browser extracts the text on upload and sends only that. Benefits:

- Sidesteps Firebase Storage, which Google has periodically moved behind the paid Blaze plan.
- Less sensitive data at rest. No document sitting in a bucket.
- Firestore's free text quota is ample.

Trade-off: you cannot re-download your original CV from ReachOut. Acceptable, since you keep the file locally anyway.

### Web framework: **Next.js (App Router) on Vercel**

You already ship Next.js in three projects, it gives the web app and API routes in one deploy, and the project is already deployed to Vercel. *Alternative considered:* Vite + React with a separate API — two deploys, no benefit here.

---

## Data model (Firestore)

```
users/{uid}
  email            string
  displayName      string
  createdAt        timestamp

users/{uid}/profile/main
  fullName         string
  headline         string      // your own positioning line
  cvText           string      // extracted CV text, the grounding for every draft
  cvFileName       string      // original filename, for your reference only
  cvUpdatedAt      timestamp
  targetRoles      string[]    // e.g. ["AI Automation Engineer", "Workflow Engineer"]
  location         string
  workAuth         string      // free text, never inferred by the model

users/{uid}/outreach/{id}
  recruiterName        string
  recruiterHeadline    string
  recruiterCompany     string
  recruiterLocation    string
  recruiterProfileUrl  string
  roleOfInterest       string
  messageType          "connection" | "message"
  draftText            string
  status               "drafted" | "sent" | "replied" | "no_response" | "rejected"
  createdAt            timestamp
  sentAt               timestamp | null
  notes                string

deviceKeys/{sha256(key)}          // TOP-LEVEL; the document ID is the hash, so the
                                  // draft endpoint resolves a key with one direct get
                                  // (no collection-group index needed). Client access
                                  // is denied entirely; the Admin SDK bypasses rules.
  uid              string
  label            string      // "Chrome on MacBook"
  createdAt        timestamp
  lastUsedAt       timestamp
  revokedAt        timestamp | null
```

Subcollections under `users/{uid}` mean every security rule is the same shape: a user reads and writes only their own tree.

---

## Auth flow

### Web
Firebase Auth, email + password, with email verification. Google sign-in optional later.

### Extension
The extension cannot share a web session cookie, so it uses a device key:

1. You log into the web app and open **Settings → Connect extension**.
2. The app generates a key, stores only its sha256 hash, and shows the raw key **once**.
3. You paste it into the extension.
4. Every extension request sends `Authorization: Bearer <key>`.
5. The API hashes it, finds the matching `deviceKeys` record, and resolves your `uid`.
6. Revoking a key from the dashboard disables that device immediately.

This is the same pattern as a personal access token, and it is why drafts can be attributed to your account rather than living in browser storage.

---

## Security decisions

Listed explicitly, per the project convention for anything touching auth or personal data.

| Decision | Reasoning |
|---|---|
| Device keys stored as sha256 hashes, never plaintext | A database leak must not yield working credentials. Raw key shown once at creation. |
| Constant-time comparison on key check | Prevents timing attacks that could leak key material byte by byte. |
| `ANTHROPIC_API_KEY` server-side only | The extension never holds it. A compromised extension cannot run up your Anthropic bill. |
| Firestore rules scope every read/write to `request.auth.uid` | Default-deny. One user can never read another's CV or outreach history. |
| CV stored as text, no file bucket | Less sensitive data at rest, smaller breach surface, avoids a paid-tier dependency. |
| Per-account daily draft cap | Limits damage from a stolen device key, and caps Anthropic spend. |
| Recruiter data stored only for rows you created | We keep what you drafted against. No recruiter database is accumulated, which keeps this a personal tool rather than a data product. |
| No auto-send, anywhere | The user is always the sender. Protects against both LinkedIn restrictions and a bad draft going out unreviewed. |

**Not yet decided — needs your input:** data retention. How long should outreach rows persist, and do you want a delete-my-account path that purges everything? Worth settling before launch rather than after.

---

## What carries over from the current build

| Component | Status |
|---|---|
| `extension/content.js` LinkedIn extractor | **Reuse as-is.** Verified working against a live profile: name, headline, company, location all correct. |
| Drafting prompt (anti-fabrication, anti-buzzword, length rules) | **Reuse as-is.** |
| `api/draft.js` structure | **Mostly reuse.** Swap token check for account lookup; add a write to `outreach`. |
| `api/_lib/auth.js` | **Replace.** Env-var tokens become Firestore device keys. |
| Side panel UI | **Trim.** Settings move to the web app; the panel keeps only the device key, plus a link to the dashboard. |

The hard part — reliable extraction from LinkedIn's hashed markup — is done and does not change.

---

## Build phases

**Phase 1 — account + profile**
Next.js app, Firebase Auth, signup/login, profile page with CV upload (parsed to text client-side), Firestore rules. *Done when:* you can sign up, upload a CV, and see your text stored.

**Phase 2 — connect the extension**
Device key generation, API auth via key lookup, extension sends the key. *Done when:* the extension drafts using the CV from your account rather than pasted text.

**Phase 3 — outreach history**
Every draft writes an `outreach` row. Dashboard lists them with recruiter, date, and draft. *Done when:* you can see everything you have drafted.

**Phase 4 — status tracking**
Mark rows sent/replied/no-response, add notes, filter. Follow-up reminders if wanted.

Phase 1 and 2 together are the point at which this becomes the product you described. Phase 3 is what makes it useful over time.

---

## Open questions

1. **Data retention** — how long do outreach rows live, and do you want full account deletion?
2. **Multi-user** — is this only ever for you, or should it be shippable to others? It affects how much polish auth and onboarding need.
3. **Domain** — stay on `reachout-seven-alpha.vercel.app`, or point a real domain at it?
4. **Firebase project** — new one for ReachOut, or reuse an existing project?
