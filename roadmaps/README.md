# Habaitica Roadmaps

This folder holds the living strategy docs for the fork. Each roadmap tracks one
initiative, calls out what is **[DONE]**, **[IN PROGRESS]**, or **[TODO]**, and
lists **open questions** that need a human decision before we proceed.

| Roadmap | Scope | File |
|---|---|---|
| Branching & upstream consolidation | How we organize branches and re-base on upstream Habitica | [`00-branching-and-upstream-sync.md`](./00-branching-and-upstream-sync.md) |
| AI SDK + Gemini upgrade | Bump `ai`, `@ai-sdk/google`, switch to Gemini 3 Flash with thinking | [`01-ai-sdk-and-gemini.md`](./01-ai-sdk-and-gemini.md) |
| Real-life rewards | Turn Habitica rewards into real-world actions (screen time, router, smart home, webhooks) | [`02-real-life-rewards.md`](./02-real-life-rewards.md) |
| Family-centric transformation | Unlock group/party features by default, tailor the app for a household | [`03-family-centric.md`](./03-family-centric.md) |

## Conventions

- Every task has a status tag: `[DONE]`, `[IN PROGRESS]`, `[TODO]`, `[BLOCKED]`,
  `[DROPPED]`.
- When code already ships a capability, link the file + commit so the
  roadmap is verifiable.
- Each roadmap ends with an **Open Questions** section. Don't silently
  decide — add the question and ping the team.
- Cross-roadmap dependencies are called out explicitly under **Depends on**.

## How to update

1. Pick a roadmap, edit the relevant task, change status and add notes.
2. For new work, add a bullet under the right phase. Keep phase ordering
   (`Phase 1`, `Phase 2`, ...) stable once other devs start planning
   against it.
3. Open questions get resolved by editing the question to include
   **Decision (YYYY-MM-DD):** and the outcome, then moving the resolved
   decision into the relevant phase.
