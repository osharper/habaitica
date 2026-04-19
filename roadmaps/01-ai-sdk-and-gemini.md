# 01 — AI SDK + Gemini Upgrade

**Goal:** Upgrade the AI task-assessment code to the latest Vercel AI SDK and
switch to **Gemini 3 Flash** with explicit **thinking** control, and audit
what else the updated ecosystem offers that would be useful here.

Depends on: roadmap 00 (clean branching) — we want these changes on a feature
branch off `habaitica-main` because they touch `package.json` and the AI
service.

## What's in the code today

- `website/server/libs/ai/taskAssessment.js` uses:
  - `ai` package
  - `@ai-sdk/google` with `google('gemini-1.5-flash')`
  - `generateText` only (no streaming, no tools, no structured output)
  - temperature 0.7 / 0.8, maxTokens 500/300
  - Prompt asks the model to reply with `APPROVED` / `REJECTED` /
    `NEEDS_REVISION` and then does a case-insensitive `includes()` on the
    response string to parse it.
- `package.json` deps (just bumped in this setup):
  - `"ai": "^6.0.6"`
  - `"@ai-sdk/google": "^3.0.2"`
- Nothing is actually installed yet in `node_modules` — the first `npm
  install` after this will pull the new major versions.
- `config.json.example` exposes `GOOGLE_API_KEY` (empty).
- Callers: `website/server/controllers/api-v3/tasks.js` dynamically
  imports `taskAssessment.js` from `addTaskChatMessage` handler.

## Latest ecosystem (April 2026)

### `@ai-sdk/google`

- **Stable:** `3.0.59` (2026-04-06).
- **Beta v4:** up to `4.0.0-beta.27`, adds:
  - `reasoning-file` content type
  - `finishMessage` field on `providerMetadata`
  - `gemini-embedding-2-preview`
  - multimodal content parts in embeddings
- Supports Gemini 3 file attachments since `3.0.5`.

### `ai` (core)

- Stable structured outputs across `generateText` / `streamText` / the
  `ToolLoopAgent` abstraction.
- `Output.object()` with Zod / Valibot / JSON Schema validation.
- `streamText` supports `partialOutputStream` so the UI can render
  assessment reasoning as it arrives.
- Tools + structured output now composable in one call, which is
  exactly the shape we want for assessment: *structured verdict +
  optional tool call to request another photo / summary*.

### Gemini 3 Flash

- **Model id:** `gemini-3-flash-preview`.
- **Thinking** controlled by either:
  - `thinking_level` with values `minimal` | `low` | `medium` | `high`
    (replaces the older `thinking_budget` knob), OR
  - `thinkingConfig: { includeThoughts: true }` to surface the
    reasoning as visible "thought parts".
- Vision: same modalities as 1.5 Flash (image, PDF, audio) plus the
  new file-reasoning type from `@ai-sdk/google@3.0.5+`.
- Pricing: Flash tier, cheaper than the 1.5 Flash we use today.

> Note: user asked for "Gemini 3.1 Flash with thinking". Google's
> current Flash line includes `gemini-3-flash` (stable API alias under
> `gemini-3-flash-preview`) and the smaller `gemini-3.1-flash-lite`
> which debuted "Deep Think Mini" in March 2026. We have two viable
> choices — see Open Questions.

## Work items

### Phase 1 — version bump & model switch (small)

- [DONE] Bump `ai` to `^6.0.6` and `@ai-sdk/google` to `^3.0.2` in
  `package.json` (was `^4.0.38` / `^1.0.11`).
- [TODO] Tighten pins after install to the latest stable: `ai@^6.0.x`,
  `@ai-sdk/google@^3.0.59`. Decide on beta v4 later (see Open Questions).
- [TODO] Replace model id in both call sites of
  `website/server/libs/ai/taskAssessment.js`:
  ```diff
  - model: google('gemini-1.5-flash')
  + model: google('gemini-3-flash-preview', {
  +   thinking_level: 'medium',  // start conservative
  + })
  ```
- [TODO] Move the model id and thinking level into config
  (`nconf.get('AI_MODEL')`, `nconf.get('AI_THINKING_LEVEL')`) with
  sensible defaults, so we can A/B the model without deploying code.
- [TODO] Add `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL` to
  `config.json.example`.

### Phase 2 — structured output (reliability win)

Today we regex the response string. That's fragile — models paraphrase,
add emoji, skip keywords. Replace with the stable `generateText` +
`Output.object()` pattern:

- [TODO] Define a Zod schema for the verdict:
  ```js
  import { z } from 'zod';
  const AssessmentSchema = z.object({
    verdict: z.enum(['approved', 'rejected', 'needs_revision']),
    confidence: z.number().min(0).max(1),
    feedback: z.string(),
    missingEvidence: z.array(z.string()).optional(),
  });
  ```
- [TODO] Switch `assessTaskCompletion` to
  `generateText({ model, messages, experimental_output: Output.object({ schema: AssessmentSchema }) })`
  (or the now-stable `output`).
- [TODO] Drop the string parsing. Expose `missingEvidence` to the
  frontend so the chat modal can render actionable bullet points.
- [TODO] Update `aiAssessmentStatus` / `aiChatMessages` shapes if we
  want to persist confidence & missingEvidence (backwards-compatible
  addition only — don't mutate existing schema values).

### Phase 3 — streaming + thinking visibility (UX win)

- [TODO] Add `streamTaskAssessment()` that uses `streamText` with
  `thinkingConfig: { includeThoughts: true }`, returning an SSE stream.
- [TODO] New endpoint `POST /api/v3/tasks/:taskId/chat/stream`.
- [TODO] Frontend `aiChatModal.vue`:
  - Render `textStream` as it arrives.
  - Collapse a "Thinking…" block with the thought parts (so the kid
    / user sees the model reasoned and didn't just rubber-stamp).
  - Show final verdict + structured fields when stream completes.
- [TODO] Document in the IMPLEMENTATION_GUIDE that streaming requires
  adjusting the CSP header added by upstream (`2ee2b05d1c` —
  `connect-src 'self'` must allow the stream URL).

### Phase 4 — multimodal proof

Kids will want to submit photos, audio, maybe a short video of a
piano practice. `@ai-sdk/google@3` already handles file parts.

- [TODO] Extend `aiChatMessages.attachments` to store full file objects
  `{ url, mimeType, size }` instead of bare URLs (migration script
  needed).
- [TODO] Either upload directly to S3 (existing `S3_*` config) or
  proxy via the server. Decision captured in Open Questions.
- [TODO] Pass attachments to the model as
  `{ type: 'file', data: <buffer|url>, mimeType }` instead of
  stringified URLs (current code does `currentContent += '\n\nAttachments: ' + attachments.join(', ')`
  which never actually gives the model the image).
- [TODO] Audio: use Gemini's native audio understanding to verify e.g.
  "practice guitar 20 min" with a recorded clip.
- [TODO] PDF: homework upload verification.

### Phase 5 — tool use (smart follow-ups)

- [TODO] Give the assessor model tools:
  - `requestAdditionalPhoto(reason)` — appends an assistant message
    asking for another shot.
  - `suggestChecklistItems(items)` — populates a structured
    "what to show me" list in the UI.
  - `recordAssessmentOutcome(verdict)` — the mandatory terminal tool
    so we always get a structured result even when thinking is high.
- [TODO] Use `ToolLoopAgent` from AI SDK v6 so the model can iterate
  without us hand-rolling a retry loop.

### Phase 6 — abuse & safety

- [TODO] Rate-limit `POST /tasks/:taskId/chat` per user (reuse the
  existing `rate-limiter-flexible` dep). Today it's unprotected.
- [TODO] Cap `aiChatMessages` length (say, 50 messages per task) and
  archive rather than truncate — AI context cost scales linearly.
- [TODO] Add content filtering using Gemini safety settings; log but
  don't act on `safetyRatings` above thresholds.
- [TODO] Token budget per user per day (adult) / per child; surface
  in user preferences for the household plan.
- [TODO] Prompt-injection hardening: treat the user's `task.text` /
  `task.notes` as untrusted when building the system prompt.

### Phase 7 — beyond task assessment

Inventory of other places AI can help in Habaitica:

- [TODO] **Reward suggestion** — given a user's completed dailies,
  suggest realistic real-world rewards (ties into roadmap 02).
- [TODO] **Task breakdown** — user types "learn violin"; AI splits
  into dailies/todos/habits with reasonable difficulty. Would use
  `generateObject` with a schema for a bundle of tasks.
- [TODO] **Weekly review** — Sunday digest per family member with
  streaks, missed dailies, highlight tasks for the week ahead.
- [TODO] **Chat moderation** for group chats (families) — flag /
  summarize rather than ban.
- [TODO] **On-device embeddings / search** — `gemini-embedding-2-preview`
  to search across a family's tasks & notes ("what did Lina do last
  week about piano?").
- [TODO] Consider a provider abstraction so Ollama / Claude / GPT can
  be swapped in. Vercel AI SDK already does this — we just need to
  not import `@ai-sdk/google` directly in the service layer.

## Environment & config

- [TODO] Document in `config.json.example`:
  - `GOOGLE_API_KEY` — required for AI features.
  - `GEMINI_MODEL` — default `gemini-3-flash-preview`.
  - `GEMINI_THINKING_LEVEL` — default `medium`.
  - `AI_STREAMING_ENABLED` — default `true` once Phase 3 ships.
- [TODO] Secret scanning — ensure nobody commits a real `GOOGLE_API_KEY`
  (enable Dependabot + secret scanning, currently disabled per
  `gh repo view` output).

## Testing

- [TODO] Unit test `taskAssessment.js` with a mocked `ai` SDK (use
  `nock`-style mocking of the google provider via
  `MockLanguageModelV2` helper shipped by AI SDK).
- [TODO] Integration test: end-to-end chat → verdict → task completion
  gated by verdict.
- [TODO] Snapshot the Zod schema so breaking schema changes are caught.
- [TODO] Evaluation harness: sample of good/bad submissions; run
  nightly against current config to detect model drift.

## Decisions recorded (2026-04-20)

- **Q1 — Default model:** `gemini-3-flash-lite` with
  `thinking_level: 'low'`. Escalation to `gemini-3-flash-preview`
  when the lite model returns `needs_revision` is a **follow-up**
  (PR 5 or later); start with the single-model baseline.
- **Q3 — API key:** single server-wide `GOOGLE_API_KEY` via `nconf`.
  No per-family / per-user keys in the first pass. Self-hosters
  will share one key per deployment.
- **Q5 — Attachment storage:** local filesystem under
  `content_cache/ai-attachments/<userId>/<uuid>.<ext>`. Good enough
  for single-host deployments which is the primary target today.
  S3 remains an open escape hatch (future `nconf.get('AI_ATTACHMENT_STORE')`
  could switch between `fs` and `s3`).

## Execution plan (PRs)

Each bullet is a standalone PR into `habaitica-main`, reviewed and
merged independently so regressions stay easy to bisect.

1. **PR 1 — Foundation: model upgrade + structured output** `[NEXT]`
   - Add `zod` dependency (already likely transitively present; pin
     explicitly).
   - Introduce `AssessmentSchema` (Zod): `{ verdict:
     'approved'|'rejected'|'needs_revision', rationale: string,
     missingEvidence?: string[], suggestedActions?: string[] }`.
   - Rewrite `assessTaskCompletion` to use `generateObject` with
     `schema: AssessmentSchema` — drop the string-regex parsing.
   - Add `GEMINI_MODEL` (default `gemini-3-flash-lite`) and
     `GEMINI_THINKING_LEVEL` (default `low`) to `config.json.example`
     and `libs/setupNconf.js`.
   - Wire model id + thinking level into `taskAssessment.js`.
   - Unit tests with `MockLanguageModelV2`.
   - `missingEvidence` surfaced in the assistant's response
     message.
2. **PR 2 — Streaming**
   - Add `streamTaskAssessment()` using `streamText` with
     `includeThoughts: true`.
   - New endpoint `POST /api/v3/tasks/:taskId/chat/stream` returning
     SSE.
   - Frontend `aiChatModal.vue`: render incrementally; "Thinking…"
     block collapsed by default (Q4 left open — hide from kids later).
   - CSP header audit documented.
3. **PR 3 — Multimodal attachments**
   - Local-FS attachment store at
     `content_cache/ai-attachments/<userId>/<uuid>.<ext>`. New
     helper `libs/ai/attachmentStore.js`.
   - Extend `aiChatMessages.attachments` schema: `{ id, mimeType,
     size, storagePath }`.
   - Upload handler with file-size cap (5 MB), MIME allowlist
     (`image/*`, `audio/*`, `application/pdf`).
   - Pass to Gemini as `{ type: 'file', data: fs.readFileSync(...),
     mimeType }`.
   - Garbage-collect attachments older than 30 days via cron.
4. **PR 4 — Safety + limits**
   - Rate-limit `POST /tasks/:taskId/chat` per user (e.g. 30/hour,
     configurable).
   - Cap `aiChatMessages` at 50 entries; archive older to a summary
     field.
   - Enable Gemini safety settings (default `BLOCK_MEDIUM_AND_ABOVE`).
   - Token budget per user/day tracked in Mongo (`User.aiUsage`).
   - Treat `task.text` and `task.notes` as untrusted when building
     the prompt (prompt-injection defense).
5. **PR 5 — Tool use (optional, evaluate after PR 1-4 land)**
   - Give the assessor model tools: `requestAdditionalPhoto`,
     `suggestChecklistItems`, `recordAssessmentOutcome`.
   - Use AI SDK's tool-loop agent.
   - Escalation to the bigger Flash model on `needs_revision`
     happens via a tool call.

## Deferred questions (answer when the code arrives there)

- **Q2. Beta track (`@ai-sdk/google@4.x-beta`)?** Defer — stay on
  stable `3.x` until the beta features (reasoning-file,
  embedding v2) become relevant.
- **Q4. Thinking visibility to kids.** Defer to PR 2. First pass:
  collapse thinking by default for everyone. Second pass: hide
  entirely for users flagged as kids (roadmap 03).
- **Q6. Privacy.** Defer — revisit when we implement the EU-region
  toggle in roadmap 02.
- **Q7. Localization of prompts.** Defer — start English-only,
  revisit after roadmap 03's family-locale audit.
- **Q8. Offline / self-hosted fallback.** Ollama with `llama3.1` works
  for simple yes/no assessment; worth a `nconf.get('AI_PROVIDER')`
  switch between `google` and `ollama`?
