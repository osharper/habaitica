# Habaitica — Agent Primer (server + web)

## TL;DR

Fork of [`HabitRPG/habitica`](https://github.com/HabitRPG/habitica) (forked from
`5.41.6`). Node 20 + Express + Mongoose 8 (MongoDB with replicaset) + Vue 2 +
Vuex + Vite. Custom fork features: AI task assessment (Gemini), task-locked
rewards, reward actions (webhooks / push / API polling).

- **Default branch:** `habaitica-main` (**protected**: PR + 1 approval, no
  force pushes, no deletions).
- **Upstream tracking branch:** `upstream-sync` (mirrors
  `HabitRPG/habitica develop`).
- **Parallel mirror:** `develop` — pristine upstream snapshot; don't commit
  fork work there.
- **Workspace root:** `~/Work/habaitica-workspace/` — see `../AGENTS.md`.

Roadmaps live in `roadmaps/`. Read the relevant one (especially
`README.md`) before non-trivial changes.

## Before you start

1. Read `roadmaps/README.md` + the roadmap relevant to your task.
2. Check `git status`; don't stack unrelated changes.
3. **Never commit** `config.json`, `*.key`, `*.pem`, real API keys, or
   anything under `keys/`. Put secrets in env vars instead (`nconf`
   already reads them).
4. Agents work on branches named `agent/<agent-name>/<topic>` and open
   PRs to `habaitica-main`. No direct pushes to protected branches.

## Repo map

```
website/server/     Express API
  controllers/
    api-v3/         primary REST surface
    api-v4/         newer endpoints (bulk-score, reward actions)
    top-level/      non-REST (webhooks, static, email)
  libs/             business logic (tasks, groups, ai, payments, chat, cron, worker)
  models/           Mongoose models (task, user, group, challenge, ...)
  middlewares/      auth, analytics, error, i18n
  index.js          entry point (see package.json#main)
website/client/     Vue 2 + Vuex SPA (Vite build)
website/common/     Shared JS/content/i18n used by server and client
migrations/         One-off Mongo migration scripts, archived by year
gulp + gulpfile.js  Build + test pipeline
test/               Mocha: api-v3, api-v4, common, content, sanity
roadmaps/           Forward-looking plans; the source of truth for intent
```

## Where to add things

| Change | Where |
|---|---|
| REST endpoint | `website/server/controllers/api-v3/<area>.js` — use `authWithHeaders`, `req.check*` validation, `apidoc` block above the handler |
| Mongoose field | `website/server/models/<name>.js` — **additive only**. Add migration if it transforms existing data |
| Server business logic | `website/server/libs/<area>/` |
| Shared logic (used client+server) | `website/common/script/ops/` or `website/common/script/libs/` |
| Vue component | `website/client/src/components/<area>/` |
| Vuex state | `website/client/src/store/{state,actions,mutations,getters}/<area>.js` |
| Translation key | `website/common/locales/en/<file>.json` and mirror in other locales (run the `locales-sync` agent) |
| Server test | `test/api-v3/<area>/` or `test/common/<name>.test.js` |
| Client test | `website/client/tests/` (Vitest via `vite.config.mjs`) |

## Run it

```bash
nvm use                   # Node 20 from .nvmrc
cp config.json.example config.json
# Fill GOOGLE_API_KEY to exercise AI assessment; most other secrets optional
npm install               # postinstall runs gulp build + client install
npm run mongo:dev         # MongoDB 7 replicaset — required, uses transactions
# separate shells:
npm start                 # API :3000 (node --watch)
npm run client:dev        # SPA :8080 (proxied to :3000)
```

Or `docker compose -f docker-compose.dev.yml up --build`.

Tests:
```bash
npm run lint
npm run test:api-v3:integration
npm run test:api-v4:integration
npm run test:common
npm run test:content
```

## Conventions that bite

- **Mongo replicaset is mandatory** (Mongoose transactions). First-run
  must use `npm run mongo:dev` or the Docker mongo service.
- **Sprite changes:** run `npm run sprites` before committing.
- **Route changes:** run `npm run apidoc`.
- **`res.analytics.track(...)`:** upstream is removing this API
  (`e6ffd69148`, 2026). Don't add new calls. Existing calls in
  fork-added endpoints (AI chat, reward actions) will be migrated when
  we merge 5.47.6 — see roadmap 00.
- **`hasActiveGroupPlan()` gates:** don't add new call sites. Use the
  forthcoming `effectiveGroupPlanActive(group)` helper from
  `libs/family/` (roadmap 03). The goal is family-mode-by-default.
- **Conventional Commits**, with `[agent:<name>]` suffix in the subject
  for agent-authored commits.
- **Locale discipline**: any new `$t('...')` key needs an entry in every
  `website/common/locales/*/<file>.json`. Untranslated keys should be
  marked `TRANSLATE: <english>` and opened as a TODO in roadmap 03.

## Danger zone (tests mandatory, go slow)

- `website/server/libs/tasks/index.js` — the score pipeline. Every
  daily/todo/reward scoring flows here, plus reward-action execution
  and unlocked-reward detection.
- `website/client/src/components/tasks/taskModal.vue` — mega-component
  that every feature touches. Easy to break.
- `website/server/libs/cron.js` — runs daily for every user.
- Anything under `website/common/` ships to both client and server —
  mind browser-vs-node imports.
- `website/server/models/task.js` — schema discriminators
  (habit/daily/todo/reward) + all fork extensions. Migration required
  for anything non-additive.

## Fork-custom features (reference)

| Feature | Key files | Roadmap |
|---|---|---|
| AI task assessment | `libs/ai/taskAssessment.js`, `controllers/api-v3/tasks.js` (≥ L1470), `models/task.js` (aiEnabled/aiChatMessages), `client/.../aiChatModal.vue`, `store/actions/tasks.js` | 01 |
| Task-locked rewards | `libs/tasks/index.js` (`checkUnlockedRewards`, reward score guard), `models/task.js` (RewardSchema.requiredTasks), `client/.../requiredTasksModal.vue`, `client/.../rewardUnlockedModal.vue` | 02 |
| Reward actions | `libs/tasks/index.js` (`rewardAction` payload, webhook + push delivery), `libs/webhookUtils.js`, `controllers/api-v4/tasks.js`, `models/task.js` (RewardSchema actionConfig/purchaseHistory/webhookLogs), `client/mixins/scoreTask.js`, `client/.../taskModal.vue` | 02 |

## Useful one-liners

```bash
git log --oneline habaitica-main..upstream-sync | head   # upstream drift
git fetch upstream && git diff --stat habaitica-main..upstream/develop
rg -tjs "hasActiveGroupPlan"                             # family-gate sites
rg -tjs "res\.analytics\.track"                          # analytics API usage
jq . config.json.example                                 # all config keys
npm outdated                                             # vs package.json
git log --oneline origin/habaitica-main -20              # recent work
```

## Agent behavior checklist

Before opening a PR as an agent:

- [ ] Branch name `agent/<name>/<topic>`.
- [ ] Conventional-commit subject with `[agent:<name>]`.
- [ ] Lint green (`npm run lint-no-fix`).
- [ ] Relevant tests added/updated.
- [ ] No touched files in the danger zone without an explicit callout
      in the PR description.
- [ ] No new `res.analytics.track` or raw `hasActiveGroupPlan`
      references.
- [ ] No new English string without a locale-file update PR or the
      `locales-sync` TODO noted.
- [ ] Roadmap updated if the work materially advances or defers a
      listed item.

## Pointers

- Workspace guide: `../AGENTS.md`.
- Roadmaps: `roadmaps/README.md`.
- Branching & upstream: `roadmaps/00-branching-and-upstream-sync.md`.
- AI + Gemini plan: `roadmaps/01-ai-sdk-and-gemini.md`.
- Real-life rewards: `roadmaps/02-real-life-rewards.md`.
- Family mode: `roadmaps/03-family-centric.md`.
- Agentic harness itself: `roadmaps/04-agentic-development.md`.
