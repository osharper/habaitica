# 00 — Branching & Upstream Consolidation

**Goal:** Give other contributors a clean entry point and keep the fork mergeable
with upstream Habitica without constant pain.

## Current state (2026-04-19)

- `origin` = `github.com/osharper/habaitica` (the fork).
- `upstream` = `github.com/HabitRPG/habitica` (canonical Habitica).
- **Branches on origin:**
  - `habaitica-main` — **default**. Contains all fork work (AI assessment,
    task-locked rewards, reward actions phases 1–5, custom docs). Forked from
    upstream at tag `5.41.6` (commit `a504b18ce4`).
  - `develop` — pristine mirror of `upstream/develop` at the time the fork
    was cloned. **Do not commit fork work here.** We keep it as an easy
    reference/diff target.
  - `upstream-sync` — tracks `upstream/develop`. Updated with `git fetch
    upstream && git push origin upstream-sync:upstream-sync --force-with-lease`.
  - `claude/habaitica-fork-setup-…` — old working branch, now redundant.
    See [Cleanup](#cleanup) below.
- **Upstream drift:** 121 non-merge commits, 6 minor versions (`5.41.6 →
  5.47.6`), 669 files touched, +21k / −11k lines.

## Branch strategy [DONE]

- [DONE] Default branch renamed to `habaitica-main` via `gh api -X PATCH
  repos/osharper/habaitica -f default_branch=habaitica-main`.
- [DONE] Pushed `habaitica-main` with the full custom history + a followup commit
  bumping the AI SDK versions in `package.json` and adding `GOOGLE_API_KEY` to
  `config.json.example`.
- [DONE] Pushed `upstream-sync` tracking `upstream/develop`.

### Rules for contributors

1. **Base all feature branches on `habaitica-main`.**
2. Branch naming: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`,
   `ai/<short-name>`, `family/<short-name>`, `rewards/<short-name>`.
3. Open PRs targeting `habaitica-main`. PRs targeting `develop` will be closed
   (that branch is just a vendored upstream snapshot).
4. Don't rewrite history on `habaitica-main` without announcement.

### Cleanup

- [TODO] Delete the `claude/habaitica-fork-setup-…` branches on both origin
  and local after confirming no open PRs reference them.
  ```bash
  git push origin :claude/habaitica-fork-setup-011CV2BvketbdfrRdtGgoyv8
  git branch -D claude/habaitica-fork-setup-011CV2BvketbdfrRdtGgoyv8
  ```
- [TODO] Add branch protection on `habaitica-main` (require PRs, require status
  checks once CI is green). Can be done via `gh api -X PUT
  repos/osharper/habaitica/branches/habaitica-main/protection`.

## Upstream consolidation plan

Goal: catch up to `upstream/develop@5.47.6` on top of our custom features
without losing anything, then stay within 1–2 weeks of upstream.

### High-level approach — merge, not rebase

Rationale: our fork has 11 thematic commits that tell the story of how the
custom features were built; rebasing them onto upstream risks breaking them
silently because upstream refactored the task/score pipeline. Merge gives us a
single conflict-resolution point and an auditable merge commit.

### Known conflict areas (pre-analysis)

Diff `a504b18ce4..upstream/develop`:

| File | Conflict risk | Why |
|---|---|---|
| `package.json` | **High** | Upstream dropped `run-rs`, `webpack-bundle-analyzer`; added `heapdump`, `micromustache`, `nan`; bumped `mongoose` to `8.23`, `habitica-markdown` to `4.1`. We bumped `ai@^6` and `@ai-sdk/google@^3`. |
| `website/server/libs/tasks/index.js` | **High** | Upstream removed the `res.analytics.track('team task scored', …)` call and changed the signature of `shared.ops.scoreTask` / `shared.fns.randomDrop` to stop taking `res.analytics`. Our fork heavily extended this file for reward actions + unlocked-reward detection. |
| `website/server/controllers/api-v3/tasks.js` | **High** | Upstream removed `res.analytics.track('challenge task created')` and `res.analytics.track('task edit')`. Our fork added ~150 lines for `addTaskChatMessage`, `getTaskChatMessages`, `toggleTaskAI` at the bottom. |
| `website/server/models/task.js` | Medium | We added `aiEnabled`, `aiChatMessages`, `aiAssessmentStatus`, `requiredTasks`, full reward-actions schema. Upstream mostly untouched in conflicting lines, but schemas get reordered — watch discriminator options. |
| `website/server/middlewares/analytics.js` | Medium | Upstream reworked analytics in `feat(analytics): initial Habitica-owned solution` (`e6ffd69148`). Our code still calls `res.analytics.track(...)` in the fork-added endpoints. May need shim or migration. |
| `website/client/package.json` | Medium | Upstream bumped Vite, Vue deps. |
| CSP / helmet changes (`server.js`) | Medium | Upstream introduced CSP and later had to `fix(auth): downgrade helmet`. Our new AI endpoints stream from Gemini — need to validate CSP headers don't block inline scripts that modals rely on. |
| `website/client/src/components/tasks/*` | Low | We added new files (`aiChatModal.vue`, `requiredTasksModal.vue`, `rewardUnlockedModal.vue`) and edited `task.vue` / `taskModal.vue`. Upstream also touched these around stat-allocation modals. |
| `website/common/locales/en/tasks.json` | Low | Both sides appended keys; merge should be straightforward. |
| Docker + tooling | Low | Upstream added `docker-compose.mongo-only.yml`, `docker-compose.mongo-test-local.yml`, `scripts/start-local-mongo.mjs`, replaced `run-rs`. We keep `docker-compose.dev.yml`. We want both. |

### Upstream feature highlights worth adopting intentionally

| Upstream commit | Why it matters |
|---|---|
| `feat(analytics): initial Habitica-owned solution` (`e6ffd69148`) | Replaces third-party analytics plumbing. Our fork still uses the old `res.analytics.track` API. Must either adopt the new service or remove analytics calls from fork-added endpoints. |
| `Implement stat allocation & auto stat allocation` (`a8062ad615`) | Big UX change, must not be regressed by our task modal edits. |
| `Replace browser confirmations with confirmation modals` (`781a904583`) | Could replace ad-hoc `confirm()` we might have added. |
| `Chat optimization` (`5dd9711413`) | Affects chat data-model perf. Doesn't touch AI chat, but both share vocabulary. |
| `Implement Content-Security-Policy` (`2ee2b05d1c`) + fixes | Required before any production deploy. |
| `Rework how strings are localized` (`5.44.0`) | If we added English-only strings for AI/reward actions, audit. |
| `Update local dev MongoDB versions` (`5dd9711413`) | Aligns with our `mongo:dev` scripts; replaces `run-rs` with `scripts/start-local-mongo.mjs`. |
| `add config to disable ssl and base_url enforcement` (`15587`) | Useful for local dev with our features. |

### Step-by-step consolidation plan

**Status (2026-04-20):** First full upstream consolidation merge complete
on branch `agent/upstream-sync/merge-5.47.6` — open as PR against
`habaitica-main`. Four conflict files (`tasks.json` locale, `user.vue`,
`taskModal.vue`, `libs/tasks/index.js`), all resolved as unions except the
`res.analytics.track('team task scored', ...)` block, which was dropped
per the analytics migration below.

1. **[DONE] Prep merge branch**
   ```bash
   git fetch upstream
   git checkout -b chore/upstream-merge-5.47.6 habaitica-main
   ```
2. **[DONE] Attempt merge**, accept ours for fork-added files, resolve
   the high-risk files manually:
   ```bash
   git merge --no-commit upstream/develop
   ```
3. **[DONE] Analytics migration**
   - Read `website/server/middlewares/analytics.js` after merge.
   - Replace our `res.analytics.track(...)` calls in
     `api-v3/tasks.js` (AI endpoints) and `libs/tasks/index.js`
     (reward actions) with whatever shape the Habitica-owned
     analytics service expects.
4. **[DONE] Dependency reconciliation**
   - Upstream's `package.json` changes came in cleanly via the tree
     merge; fork deps (`ai@^6`, `@ai-sdk/google@^3.0.2`) preserved.
   - Re-ran `npm install` at repo root; lockfiles regenerated and
     committed in a separate commit on the merge branch.
5. **[TODO] Smoke tests** — `npm run test:api-v3:integration` and
   `test:api-v4:integration`; run our fork-added tests. Left to CI / the
   PR reviewer since the agent session doesn't have a live MongoDB
   replicaset.
6. **[TODO] Sprite/asset rebuild** — `npm run sprites` not yet rerun.
   Submodule pointer preserved (ours is newer than upstream's); running
   sprites is only required if images actually changed in our direction.
7. **[DONE] Open PR** back into `habaitica-main` so other devs can
   review the merge conflict resolution.
   ([PR link recorded in PR description](https://github.com/osharper/habaitica/pulls?q=merge-5.47.6)).

### Cadence going forward

- **Weekly** (Mondays): fetch upstream, fast-forward `upstream-sync`,
  run `git log --oneline habaitica-main..upstream-sync` → triage each
  commit as `adopt now`, `adopt next`, or `skip`.
- **Monthly**: cut a merge PR as above. Aim for ≤2 minor versions
  behind upstream so each merge stays tractable.
- **Security fixes**: cherry-pick immediately, don't wait for monthly
  merge.

## Local dev onboarding (for new contributors)

```bash
git clone https://github.com/osharper/habaitica.git
cd habaitica
# NEW: You are on habaitica-main, which already has the fork's features
nvm use          # picks Node 20 from .nvmrc
cp config.json.example config.json
# Fill GOOGLE_API_KEY to exercise AI assessment; other secrets optional
npm install      # runs gulp build + client install in postinstall
npm run mongo:dev     # MongoDB 7 replica set (transactions required)
# separate tabs:
npm start             # API at :3000
npm run client:dev    # SPA at :8080
```

Or Docker:
```bash
docker compose -f docker-compose.dev.yml up --build
```

## Decisions

- **Q1. `develop` branch → delete.** `develop` is a stale upstream
  snapshot. Our own fork work lives on `habaitica-main`; pristine
  upstream is reachable via the `upstream` remote or the
  `upstream-sync` branch. Keeping `develop` invites PRs against the
  wrong base. [DONE in this PR: `git push origin --delete develop`.]
- **Q2. Fork rebrand → full.** `package.json#name` is already renamed
  to `habaitica` in this PR (with `package.json#description` updated).
  A staged full rebrand — emails, UI strings, push notifications,
  docker image names, OAuth apps — is tracked separately in
  [roadmap 05](./05-brand-and-content.md). Track A of that doc is the
  full naming sweep; Track B is the owned-art plan that Q4 below
  depends on.
- **Q3. CI scope → strip to essentials.** Keep lint and the
  api-v3/api-v4 integration suites plus `test:common`; drop upstream's
  Weblate/Loggly/etc. workflows. (Already recorded earlier.)
- **Q4. Content submodule → pin, plan to own.** We pin
  `habitica-images` to its current commit and stop auto-bumping on
  upstream merges. New upstream art does not appear in Habaitica
  automatically. In parallel we commit to building our own art
  repository under a Habaitica-chosen license (tentatively
  CC-BY-SA 4.0). Full plan in [roadmap 05, Track B](./05-brand-and-content.md#track-b--owned-art--content).
  Rationale: the upstream image repo is governed by a license that
  blocks commercial redistribution and bakes in Habitica trademark
  elements; we cannot build a brand-independent product while using
  it long-term.
- **Q5. License → GPLv3 with notice.** The fork stays fully
  open-source under the same GPLv3 as upstream. `NOTICE.md` at the
  repo root credits HabitRPG, states trademark posture (we do not use
  the Habitica name or logo as our own brand; "Habaitica" is a
  distinct fork name), and declares that Habaitica contributions are
  released under GPLv3 as part of the combined work. Any future
  commercial offering will host GPLv3 code — consistent with the
  upstream's own license posture. [DONE in this PR: `NOTICE.md`
  added.]
- **Q6. Commit messages → Conventional Commits encouraged, not
  enforced.** Hard rule: every commit authored by an agent carries
  an `[agent:<name>]` suffix. Conventional Commit prefixes
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) are
  encouraged but not gated by `commitlint`. (Already recorded
  earlier.)
- **Q7. Signed commits → not enforced.** Threat model is small
  maintainer + trusted agents. Branch protection (PR required, 1
  approval, conversation resolution) is the bar. Revisit if we grow
  to >5 humans or start a public release cadence.

## Still-open questions

None that block the next phase. The questions carried forward —
translator coordination, final art license, and asset budget — live in
[roadmap 05](./05-brand-and-content.md#open-questions) because that's
where they actually apply.
