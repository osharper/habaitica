# 04 — Agentic Development Harness

**Goal:** Make agent-driven work on Habaitica (and the planned mobile /
router / HA companions) as reliable and autonomous as possible. This
roadmap is a **proposal** based on what I hit while onboarding in this
session. Nothing here is shipped yet; it's a plan for how we set up the
agents, their tools, and their memory.

## What this session taught me (pain points to automate)

Raw observations from onboarding, catalogued so they become work items:

1. **Fork-vs-upstream analysis is a whole workflow.** I needed `git fetch
   upstream`, careful range-diffs, conflict-hotspot heuristics,
   release-note reading. Doing this manually every month is a tax; an
   agent with the right runbook can do it in minutes.
2. **"Where does X live?" is a cross-directory grep.** A feature like
   AI assessment touches `website/server/libs/ai/`, `website/server/models/task.js`,
   `website/server/controllers/api-v3/tasks.js`, `website/client/src/store/actions/tasks.js`,
   and `website/client/src/components/tasks/aiChatModal.vue`. A locator
   skill primed with the project's layout would cut context-gathering
   dramatically.
3. **Docs and code disagreed.** `IMPLEMENTATION_GUIDE.md` said "frontend
   needs completion" but components already shipped in later commits.
   Agents need to cross-check docs against code and flag drift.
4. **Dep + version reality vs. declared.** `package.json` claimed `ai@^4.0.38`
   but `node_modules` was empty and the code used `generateText` which
   moved namespaces between v4 and v6. An agent should proactively run
   `npm ls` / `npm outdated` and resolve the truth.
5. **Mongo replicaset requirement** is non-obvious and breaks first-run
   setup. Bake it into the bootstrap skill.
6. **Sprites, apidoc, postinstall gulp build** are landmines. Forgetting
   them costs 10 minutes of bewildered debugging. Agents should know
   the full build matrix.
7. **Task modal is a mega-component** (`taskModal.vue`). Every custom
   feature and every upstream change touches it. It needs its own
   care-and-feeding skill.
8. **Localization sprawl.** Adding a string means touching N files under
   `website/common/locales/*/`. Totally mechanical — prime agent work.
9. **Upstream removes `res.analytics` parameters** and our fork still
   passes them. Needle-in-haystack regression, perfect for a repo-wide
   grep agent to catch.
10. **Multiple targets (web, iOS, Android, router, HA)** each with
    different toolchains. A workspace-wide agent setup beats
    repo-at-a-time.

## Target setup — three layers

```
┌──────────────────────────────────────────────────────┐
│  1. Workspace root  (~/Work/habaitica-workspace)      │
│     ├── AGENTS.md           ← shared across repos     │
│     ├── .cursor/rules/      ← workspace-scope rules   │
│     ├── habaitica/          ← server+web (this repo)  │
│     ├── habaitica-android/  ← fork of HabitRPG/habitica-android │
│     ├── habaitica-ios/      ← fork of HabitRPG/habitica-ios     │
│     ├── habaitica-openwrt/  ← new repo, Gatekeeper pkg          │
│     ├── habaitica-homeassistant/ ← new repo, HA custom integration │
│     └── ops/                ← deploy scripts, k8s, secrets vault  │
└──────────────────────────────────────────────────────┘
```

Each repo has its own `CLAUDE.md` for repo-specific guidance. Shared
conventions live in workspace-level `AGENTS.md`.

## CLAUDE.md (per repo) — contents I'd put in this one

Proposed outline for `habaitica/CLAUDE.md`. Should be kept short
(<400 lines) — agents follow it better when it's skimmable.

```markdown
# Habaitica — Agent Primer

## TL;DR
Fork of HabitRPG/habitica (5.41.6). Node 20 + Express + Mongoose + Vue 2.
Default branch: habaitica-main. Upstream tracked on upstream-sync.
Custom features: AI task assessment, task-locked rewards, reward actions.
Planning docs live in roadmaps/.

## Before you start
- Read roadmaps/README.md and any roadmap relevant to your task.
- Check git status; don't stack unrelated changes.
- NEVER commit config.json or anything matching *.key / *.pem.

## Repo map (15 lines max)
website/server     Express API (controllers/{api-v3,api-v4,top-level}, libs, models, middlewares)
website/client     Vue 2 + Vuex + Vite SPA
website/common     Shared content, i18n, ops logic (runs on both server and client)
migrations         One-shot Mongo migration scripts
gulp + gulpfile.js Build + test pipeline
test               Mocha (api-v3, api-v4, common, content)
roadmaps           Forward-looking plans — read the relevant one first

## Where to add things
- REST endpoint: website/server/controllers/api-v3/<area>.js (see existing handlers, use authWithHeaders, apidoc block)
- Mongoose field: website/server/models/<name>.js (additive only; add migration if needed)
- Business logic: website/server/libs/<area>/
- Vue component: website/client/src/components/<area>/
- Vuex action: website/client/src/store/actions/<area>.js
- Translation key: website/common/locales/en/<file>.json + mirror in other locales with a note
- Test: test/api-v3/<area>/ or test/common/<name>.test.js

## Run it
npm install              # includes postinstall: gulp build + client install
npm run mongo:dev        # MongoDB 7 replica set — required, uses transactions
npm start                # API :3000
npm run client:dev       # SPA :8080
npm run test:api-v3:integration

## Conventions that bite
- Every Mongoose change needs a migration if it renames/transforms data.
- Sprite changes: `npm run sprites` before committing.
- After editing routes: `npm run apidoc` to regenerate.
- Don't use `res.analytics.track` in new code — upstream is moving off it; see roadmaps/00.
- Don't gate new features on `hasActiveGroupPlan()`; use the forthcoming `effectiveGroupPlanActive()` helper (roadmaps/03).

## Danger zone
- website/server/libs/tasks/index.js — score pipeline, VERY hot. Tests are mandatory.
- website/client/src/components/tasks/taskModal.vue — mega-component. Merge carefully.
- website/server/libs/cron.js — runs for every user every day.
- Any edit under website/common/ ships to both client and server — mind imports.

## Useful commands
git log --oneline habaitica-main..upstream-sync | head    # upstream drift
rg -tjs "hasActiveGroupPlan"                              # family-gate sites
jq . config.json.example                                  # all config keys
```

Workspace-level `AGENTS.md` would mirror the Cursor OSS convention: a
shorter file pointing to per-repo `CLAUDE.md`s plus cross-repo rules
(commit style, PR template, security posture, secrets handling).

## Subagents to introduce

Picking the ones where I'd reach for a specialized agent repeatedly.
Each needs a clear **trigger phrase**, a **scope** (read / write), and
a **harness** (what tools it gets).

### Tier 1 — build now, used on almost every session

1. **`upstream-sync`** — Runs the weekly triage loop in roadmap 00:
   `git fetch upstream`, list new commits, classify each as
   `adopt now` / `skip` / `defer`, draft a merge PR with conflict
   notes. Read-only except on a dedicated `chore/upstream-merge-*`
   branch.
   - Harness: `git`, `gh`, read-only code access, `rg`.
   - Memory: `roadmaps/00-branching-and-upstream-sync.md` +
     `.cursor/memory/upstream-triage.md` (running log of decisions).

2. **`feature-locator`** — Given a feature name ("AI assessment",
   "reward actions", "family gate"), returns the full cross-stack
   list of relevant files + line ranges. Read-only.
   - Harness: `rg`, `glob`, read access.
   - Memory: a keyed map of feature → file globs in
     `.cursor/memory/feature-map.md`; updated when new features land.

3. **`endpoint-author`** — Scaffolds a new REST endpoint (controller
   file, auth middleware, request validation, apidoc block, matching
   Vuex action, at least one integration test). Write access.
   - Harness: templates, `apidoc`, `eslint --fix`, `mocha`.

4. **`locales-sync`** — Takes a new English key/value pair, adds it
   to every `website/common/locales/*/` file (marking non-English as
   `TRANSLATE: <en>`), opens a TODO in `roadmaps/03-family-centric.md`
   if the string is family-specific.
   - Harness: file write, `jq`.

5. **`migration-writer`** — Given a Mongoose field change, generates
   a `migrations/archive/<yyyy>/<yyyymmdd>_<slug>.js` script using
   the project's existing migration style, plus unit coverage.
   - Harness: file write, `mongosh`, `monk`, `node`.

6. **`playwright-qa`** — Drives the web client via the
   `cursor-ide-browser` MCP to run smoke scenarios: login, create a
   daily, score it, buy a locked reward, trigger an AI chat. Writes
   reproducer scripts under `test/e2e/` and screenshots under
   `test/e2e/artifacts/`.
   - Harness: `cursor-ide-browser` MCP, `cross-spawn` to boot dev
     server, Playwright when we add it as a dep.

7. **`code-reviewer`** — Read-only. Runs on every PR (or on demand):
   lint, test, style, security heuristics (SSRF-in-webhook, leaking
   secrets, missing auth middleware), upstream-drift check.
   - Harness: `eslint`, `rg`, `gh pr diff`.

### Tier 2 — build when we start the relevant roadmap

8. **`ai-evaluator`** — For roadmap 01. Runs a fixed eval set of
   task-assessment submissions against the current Gemini config,
   scores precision/recall of approve/reject, flags regression.
   - Harness: Gemini API key, `ai` SDK, fixtures.

9. **`webhook-inspector`** — For roadmap 02. Spins up a
   `smee.io`/`ngrok` tunnel, registers a test webhook on a local
   reward, fires it, verifies signature + idempotency headers.
   - Harness: `ngrok` or `localtunnel`, `curl`, Mongo read.

10. **`reward-action-tester`** — End-to-end: buy reward → push
    delivered → HA/OpenWrt fixture reacts → polling endpoint
    reflects duration. Uses a stubbed HA + openwrt docker-compose.

11. **`family-mode-auditor`** — For roadmap 03. Greps for
    `hasActiveGroupPlan`, `group.purchased.plan`, paywall strings,
    and asserts each gate either uses `effectiveGroupPlanActive()`
    or is explicitly allow-listed.

12. **`dep-upgrader`** — Monthly. Runs `npm outdated` across
    workspace, clusters updates by risk, drafts upgrade PRs. Watches
    `ai`, `@ai-sdk/google`, `mongoose`, `vue`, `bootstrap-vue` (4-year-old)
    with higher care.

### Tier 3 — aspirational / cross-repo

13. **`mobile-companion`** — Coordinated changes across
    `habaitica-android` + `habaitica-ios` + server (e.g.
    reward-action payload schema). Reads server schema, generates
    matching Kotlin data classes + Swift structs.

14. **`deploy-runner`** — Executes a deploy: Heroku (there's a
    Procfile + `.heroku/`) or K8s (`kubernetes/`). Includes safety:
    must see green CI, confirms rollout, can rollback on error.

15. **`incident-triage`** — On an alert, pulls logs, correlates with
    recent deploys, opens a draft postmortem.

## Skills (vs. subagents)

**Subagents** have their own context window and are invoked explicitly.
**Skills** are runbooks the main agent reads on demand. I'd create
these as proper Cursor skills (live under `.cursor/skills/` or your
chosen `~/.cursor/skills-…`):

- `bootstrap-habaitica.md` — "Get the stack running locally." Runs
  through config, mongo:dev, npm install pitfalls, common errors.
  Trigger: user says "set up" / "first run" / npm install fails.
- `add-task-field.md` — "Add a new field to the Task/Reward schema."
  Covers model change, migration, server sanitization, apidoc, client
  form binding, locale keys, tests. Trigger: modifying
  `website/server/models/task.js`.
- `write-api-endpoint.md` — Canonical pattern (auth, validation,
  apidoc, error handling). Trigger: new file in `controllers/api-v3`.
- `merge-upstream.md` — Step-by-step merge procedure including the
  known hotspots. Trigger: branch name matches `chore/upstream-merge-*`.
- `score-pipeline.md` — Explain how a task score flows through
  `libs/tasks/index.js` → `shared.ops.scoreTask` → cron / drops /
  webhooks. Trigger: editing anywhere in that pipeline.
- `reward-action-semantics.md` — actionType matrix, payload shape,
  delivery guarantees. Trigger: editing reward action config or the
  purchase pipeline.
- `safe-webhook.md` — SSRF checks, HMAC signing, idempotency,
  retries — the standard our outgoing webhooks must hit. Trigger:
  new `executeWebhook` caller or outbound HTTP.
- `gemini-prompt.md` — Prompt patterns, thinking levels, structured
  outputs, safety settings for our AI usage. Trigger: editing
  `libs/ai/*`.
- `translate-and-locale.md` — How to add a string. Trigger: `$t('…')`
  key not found.
- `family-gate.md` — When to ungate vs. preserve a paid gate, using
  `effectiveGroupPlanActive()`. Trigger: editing any of the 10 gate
  sites or relating to group plans.
- `release-and-deploy.md` — CI gates, version bumping, rollback.
- `mobile-schema-sync.md` — Server-to-mobile schema changes.
- `playwright-scenario.md` — Writing a new e2e happy-path.

## Harness — MCPs and CLI tools each agent needs

### MCPs already configured (keep, use)

- `cursor-app-control` — moving agent between roots, creating
  sibling repos. Useful when bringing in `habaitica-android`.
- `cursor-ide-browser` — browser automation for the web client
  (Playwright-equivalent for agent use). This is our primary QA
  harness.
- `user-MongoDB` — query the live dev DB from an agent. Gold for
  the migration-writer and incident-triage agents.

### MCPs I'd add

- **GitHub MCP** — PR creation, comment management, check status.
  Today we shell out to `gh`; MCP is more structured.
- **Context7** (or equivalent) — pull current docs for libraries
  (Mongoose, Vue, Vercel AI SDK). Reduces hallucination during
  upgrades.
- **Sentry / Datadog MCP** — once we deploy, for incident-triage.
- **Linear / GitHub Issues MCP** — for roadmap ↔ tickets sync.
- **Playwright MCP** — even though `cursor-ide-browser` covers the
  interactive case, a dedicated Playwright MCP enables headless
  test-execution in CI-like flows.

### CLI tools in the harness (install once per workspace)

Core (already present in most setups): `git`, `gh`, `node`, `npm`,
`jq`, `rg`, `fd`, `docker`, `docker-compose`, `mongosh`, `curl`.

To add:
- `ngrok` (webhook-inspector).
- `wrangler` / `cloudflared` if we end up tunneling for webhook
  tests.
- `kubectl` + `helm` (deploy-runner, once we're on K8s).
- `fastlane` + `xcodebuild` + `gradle` for the mobile repos.
- `act` (run GitHub Actions locally before pushing).
- `apidoc` CLI (already a dep, but ensure globally available for
  agents).
- `sqlc`/`mongosh` scripts directory — write agent-callable scripts
  in `scripts/agents/` so anything destructive passes through a
  narrow, audited surface.

### Secrets & config access

- **Never let agents read `config.json`.** Keep a separate
  `config.agents.json` with placeholder secrets + non-destructive
  test keys.
- Store real keys in a vault (1Password CLI, `op`, is a common and
  MCP-able choice).
- For local Gemini usage: per-developer key in `~/.habaitica/gemini`
  loaded via an envrc / `direnv`, not committed.

## Memory strategy

Three tiers, aligned with how Cursor agents work:

### 1. Repo memory (committed)

- `CLAUDE.md` — the primer above. Canonical repo context.
- `AGENTS.md` at workspace root — shared across repos.
- `roadmaps/` — forward plans (already in place).
- `.cursor/rules/` — Cursor-style rule files, per-area, e.g.:
  - `server.mdc` — conventions for `website/server/`
  - `client.mdc` — Vue 2, Vuex patterns
  - `locales.mdc` — locale file discipline
  - `tests.mdc` — mocha + chai + sinon patterns
  - `security.mdc` — secrets, SSRF, auth middleware
- `.cursor/skills/` — the skills listed above.

### 2. Agent scratch memory (committed-but-low-churn)

Under `.cursor/memory/`, rewritten by agents as they learn:

- `feature-map.md` — generated index of features → files.
  Auto-updated by `feature-locator` after every feature merge.
- `upstream-triage.md` — running log of upstream commits and our
  decision on each (adopt / skip / defer).
- `conflict-hotspots.md` — files that frequently conflict during
  merges; updated after each upstream merge.
- `eval-results-ai.md` — last run of the AI evaluator.

### 3. Session memory (not committed)

- `.cursor/session/` in `.gitignore`. Agents write ephemeral notes
  here per conversation ("I'm partway through migrating X, still need
  to do Y"). Lets a restart resume cleanly.
- `terminals/` (already a Cursor convention) — keep as-is.

### Rules for writing to memory

- Agents write to `.cursor/memory/*.md` only via a structured "append
  decision" skill so humans can review the diff.
- `CLAUDE.md` is updated by humans + the `code-reviewer` agent only.
- `roadmaps/*` updated via PR with human review, same as code.

## Wiring in iOS and Android app repos

Both are real Habitica-ecosystem repos we can fork:
- `https://github.com/HabitRPG/habitica-android`
- `https://github.com/HabitRPG/habitica-ios`

Steps to bring them into the agentic workspace:

1. **[TODO] Create a workspace root**:
   ```bash
   mkdir -p ~/Work/habaitica-workspace
   mv ~/Work/habaitica ~/Work/habaitica-workspace/habaitica
   cd ~/Work/habaitica-workspace
   ```
2. **[TODO] Fork + clone mobile repos** (via `gh repo fork` to
   `osharper/habaitica-android` + `osharper/habaitica-ios`).
   Configure `upstream` remote in each to HabitRPG's repo, mirroring
   the pattern we use here.
3. **[TODO] Workspace `AGENTS.md` + `.cursor/rules/` + `.cursor/skills/`**.
   Skills specific to a single repo stay per-repo; cross-repo skills
   (server↔mobile schema sync) live at workspace root.
4. **[TODO] Per-repo `CLAUDE.md`** in each. Each includes:
   - Tech stack (Android: Kotlin + Jetpack Compose or Views; iOS:
     Swift + SwiftUI).
   - How to run locally (Android Studio / Xcode).
   - How it talks to the server (API base URL, auth flow).
   - What fork-custom features it must support (AI chat UI, reward
     actions, family roles).
5. **[TODO] Use Cursor's multi-root workspace** or, if Cursor doesn't
   play well with three roots, a single parent root with all repos
   as subfolders (tradeoff: slower indexing).
6. **[TODO] Agents cross-referencing repos**: the workspace-wide
   `feature-locator` agent knows about all three. The
   `mobile-companion` agent is cross-repo by design.
7. **[TODO] Shared tooling**: a single `Brewfile` or setup script at
   workspace root installs every CLI any agent needs.
8. **[TODO] CI parity**: each repo has its own CI, but a
   meta-workflow (scheduled) runs a smoke test that exercises
   server+web+mobile against a staging deployment.

## QA via Playwright (web)

- **[TODO] Install Playwright** as a devDependency in
  `website/client/`. Currently absent.
- **[TODO] Scenarios dir**: `test/e2e/scenarios/*.spec.ts`. Organized
  by roadmap:
  - `ai-assessment.spec.ts` — roadmap 01
  - `reward-actions.spec.ts` — roadmap 02 (mocks webhook server)
  - `family-mode.spec.ts` — roadmap 03
  - `upstream-parity.spec.ts` — original Habitica happy paths
- **[TODO] Fixtures**: seed a Mongo `habitica-e2e` DB with a known
  family, tasks, rewards. Reset between tests with a fast
  `mongorestore`.
- **[TODO] Agent usage**: `playwright-qa` agent can author, run, and
  diagnose tests. Given a bug report, it reproduces the steps via
  `cursor-ide-browser` MCP and then codifies as a test.
- **[TODO] Headless in CI**: workflow in `.github/workflows/e2e.yml`
  runs on every PR targeting `habaitica-main`, against a throwaway
  Docker-compose stack (server + mongo + mocked Gemini).
- **[TODO] Visual regression**: Playwright screenshot diffs on
  critical flows (task-modal open, reward unlock celebration).
- **[TODO] Accessibility**: `@axe-core/playwright` integration; gate
  PRs on no-new-violations.

## Deploy pipeline (proposed)

Today the repo has Heroku (`Procfile`, `.heroku/`), Elastic Beanstalk
(`.ebextensions/`), and Kubernetes (`kubernetes/`) artifacts. For an
agentic workflow we want **one canonical path** that agents can drive.

- **[TODO] Decide deploy target.** Recommend K8s for the family
  fork (multi-tenant future-proof) with a simpler Dockerized
  single-node path for self-hosters. Drop the Heroku/Beanstalk
  scaffolding from the fork (keep in `develop` for upstream
  compatibility).
- **[TODO] GitHub Actions pipeline**:
  1. `on: pull_request` → lint + unit + integration + e2e.
  2. `on: push` to `habaitica-main` → build Docker image, push to
     GHCR, rolling-deploy to staging.
  3. Manual approval → prod deploy.
- **[TODO] Preview envs per PR** (Vercel / fly.io style) so the
  `playwright-qa` agent can exercise a PR against its own stack.
- **[TODO] `deploy-runner` agent** — wraps `kubectl rollout status`,
  watches error rate, rolls back on SLO breach.
- **[TODO] Secrets**: K8s ExternalSecrets pulling from whatever vault
  we pick. Agents never read prod secrets directly.

## Server configuration (agent-managed)

- **[TODO] Move `config.json` → env-var-first** using existing
  `nconf` hierarchy: `nconf.env()` already takes precedence. This
  lets K8s/Compose configure cleanly and keeps secrets out of
  files.
- **[TODO] Document every env var in `config.json.example`** with a
  one-line comment about what it's for, so agents can reason about
  which to set in new environments. (Current file is a flat JSON
  with zero guidance.)
- **[TODO] A `scripts/configure-env.mjs`** that prompts/validates
  required env for a given target (local, staging, prod).

## Rollout plan

### Week 1 — foundations
- Create workspace root, move repo into it.
- Write starter `CLAUDE.md` in `habaitica/`.
- Write workspace-level `AGENTS.md`.
- Install `.cursor/rules/` for server / client / locales / tests /
  security.
- Fork + clone mobile repos.

### Week 2 — Tier-1 subagents
- Implement `upstream-sync`, `feature-locator`, `endpoint-author`,
  `locales-sync`, `migration-writer`.
- Write the six most-used skills.

### Week 3 — QA harness
- Playwright scaffold in `website/client/test/e2e/`.
- First three scenario specs.
- `playwright-qa` agent wired to `cursor-ide-browser` MCP.

### Week 4 — Tier-2 subagents tied to roadmaps
- `ai-evaluator`, `webhook-inspector`, `family-mode-auditor`.
- Ship in parallel with the first roadmap milestones they support.

### Week 5+ — deploy + mobile
- CI pipeline + staging env.
- `deploy-runner` agent.
- `mobile-companion` agent after mobile repos are set up.

## Decisions recorded (2026-04-19)

- **Workspace tool:** parent-folder-of-repos at `~/Work/habaitica-workspace/`.
  Simplest, plays well with Cursor's indexing, works with `git` per
  repo without worktree quirks. [DONE — folder exists, mobile repos
  forked & cloned]
- **Skill format:** Anthropic's `skill-creator` / `SKILL.md` convention.
  Skills live at `~/.claude/skills/habaitica/<name>/SKILL.md` for
  user-scoped skills; at `habaitica/.claude/skills/<name>/SKILL.md` for
  repo-scoped ones.
- **Auto-commit for agents:** allowed, on branches named
  `agent/<agent-name>/<topic>`. All changes land through PR reviewed
  by a human. Subject format: conventional-commits with
  `[agent:<name>]` suffix.
- **LLM separation of concerns:** **Gemini** is used only by the
  Habaitica app itself (task assessment and any future in-app AI).
  **Claude** powers the coding agents via Cursor. No production
  Gemini keys route through the coding agents.
- **Branch protection:** `habaitica-main` is protected. PR required,
  1 approval minimum, no force pushes, no deletions, conversation
  resolution required. Admins not enforced (break-glass allowed).
  [DONE]

## Still-open questions
- **Q5. Self-hosted runners.** E2E that touches Mongo + Gemini is
  slow on hosted GH runners. Invest in self-hosted runners early?
- **Q6. Telemetry on agents themselves.** Track time-saved, error
  rate, false-modifications. Without this, we can't tell which
  agents to invest in. Worth building a tiny tracking layer now?
- **Q7. Safety rails.** **Decided (2026-04-20): no agent ever pushes
  directly to `habaitica-main`.** All agent work ships through a PR
  on an `agent/<name>/<topic>` branch and requires human approval.
  Enforced by the branch-protection settings on the remote.
- **Q8. How much do we let the server repo's agents know about the
  mobile repos?** Leaking mobile-only conventions into
  `habaitica/CLAUDE.md` creates confusion. Keep strict separation;
  only the `mobile-companion` agent spans repos.
- **Q9. Documentation as the source of truth.** When
  `IMPLEMENTATION_GUIDE.md` contradicts the code, which wins? (In
  this session: code did.) Add a `code-reviewer` rule that flags
  doc/code drift on PRs.
- **Q10. Cost.** Heavy agent use can run a surprising tab. Set a
  per-developer/monthly budget and alert.
