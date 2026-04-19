---
name: upstream-sync
description: Consolidate new commits from HabitRPG/habitica into the Habaitica fork. Use this whenever the user asks to merge upstream, pull latest from HabitRPG, catch up with the original Habitica, resolve upstream drift, handle the monthly upstream sync, or fix conflicts from a fetched upstream. Also trigger this when the user mentions being behind on upstream, wanting to pick up a specific Habitica version (like 5.47.6), or preparing an upstream-merge PR. Do not use for merges from other forks or from feature branches; this is specifically for the upstream HabitRPG remote.
---

# Upstream Sync — HabitRPG/habitica → Habaitica fork

This skill walks an agent through consuming new commits from
`upstream` (HabitRPG/habitica) into our `habaitica-main`. It encodes
three things you can't get from a generic merge workflow:

1. **Where the fork has diverged semantically** — the areas where
   upstream's refactors will collide with our custom features (AI
   assessment, task-locked rewards, reward actions).
2. **Conventions the Habaitica repo enforces** (protected default
   branch, agent branch naming, conventional commits with
   `[agent:<name>]`, no direct pushes).
3. **The exact gotchas we know about** as of Habitica 5.47.6, so
   you don't rediscover them the hard way.

Read the whole thing once before starting. The consolidation is
PR-based; nothing lands on `habaitica-main` without a human approving
it.

## Preconditions

Before starting, verify:

- You're in the `habaitica` server/web repo (has `website/server/` and
  `roadmaps/`), not the Android or iOS repos. Those have their own
  upstreams and their own procedure.
- `git remote -v` shows both:
  - `origin` → the user's fork (e.g. `osharper/habaitica`)
  - `upstream` → `HabitRPG/habitica`
  If `upstream` is missing, add it:
  `git remote add upstream https://github.com/HabitRPG/habitica.git`
- Working tree is clean (`git status --porcelain` is empty). If not,
  stash or commit first; don't mix upstream merge noise with unrelated
  work.
- `gh` is authenticated (`gh auth status`).
- You have `nvm` + Node 20 available (the repo ships `.nvmrc`).

## Stage 1 — Scope the drift

Always start by understanding *how much* upstream has moved and what
kind of changes they are. This shapes how invasive the merge will be
and lets you warn the user if they underestimated the work.

```bash
git fetch upstream
git fetch origin

# How many commits ahead is upstream?
git log --oneline habaitica-main..upstream/develop | wc -l

# What's the latest version tag?
git fetch upstream --tags
git tag --sort=-creatordate -l 'v*' | head -5

# Broad diffstat — which files/areas see the most churn?
git diff --stat habaitica-main...upstream/develop | tail -40

# File-level hot spots we care about the most
for f in \
  package.json \
  website/server/libs/tasks/index.js \
  website/server/libs/cron.js \
  website/server/controllers/api-v3/tasks.js \
  website/server/models/task.js \
  website/server/models/user/schema.js \
  website/server/models/group.js \
  website/common/script/ops/scoreTask.js \
  website/common/script/fns/randomDrop.js \
  website/server/middlewares/analytics.js; do
  changes=$(git log --oneline habaitica-main..upstream/develop -- "$f" | wc -l | tr -d ' ')
  echo "$changes $f"
done | sort -rn
```

Read **roadmap 00** (`roadmaps/00-branching-and-upstream-sync.md`)
before going further — it lists known conflict zones. Use the above
output to confirm whether new ones have emerged since the last sync.

Report back to the user: number of commits, latest upstream version
tag, and a one-paragraph summary of where the churn concentrates.
Ask them to confirm the target (typically "latest tag" or a specific
version like `v5.47.6`). Then move on.

## Stage 2 — Prepare the merge branch

Never merge into `habaitica-main` directly. It's a protected branch.

```bash
git checkout habaitica-main
git pull --ff-only origin habaitica-main

# Also refresh the pristine mirror — this is a convenience branch
# some agents reference for "what would upstream look like alone?".
git checkout upstream-sync
git reset --hard upstream/develop
git push --force-with-lease origin upstream-sync

# Create the actual consolidation branch.
VERSION=$(cd "$PWD" && git describe --tags upstream/develop 2>/dev/null | sed 's/-.*//')
# VERSION will be something like v5.47.6. Fallback to a short SHA if no tag.
if [ -z "$VERSION" ] || [[ "$VERSION" != v* ]]; then
  VERSION=$(git rev-parse --short upstream/develop)
fi
BRANCH="agent/upstream-sync/merge-${VERSION#v}"
git checkout habaitica-main
git checkout -b "$BRANCH"
```

Branch naming convention: `agent/upstream-sync/merge-<version>` (per
the repo's agent-branch rule).

## Stage 3 — Merge, conflict-first

Use `git merge` (not rebase). We want a single merge commit that
preserves upstream's history verbatim; rebasing would rewrite it and
make future three-way comparisons harder. Reserve rebase for tiny
cherry-picks.

```bash
git merge --no-ff --no-commit upstream/develop
```

If this succeeds without conflicts, verify and proceed to Stage 4.
In practice, there will be conflicts. Resolve them in this order
(lowest-risk → highest-risk), committing nothing until you've
resolved all of them:

### 3a. Conflicts in `package.json` / `package-lock.json`

Strategy:
- Merge both sides of dependency bumps. Prefer upstream's version
  for anything upstream actively bumped (they're running production,
  their pins are better tested).
- **Always keep our AI deps**: `@ai-sdk/google` and `ai`. Don't let
  upstream re-remove or downgrade them.
- Regenerate the lockfile rather than hand-editing — the old
  `run-rs` was removed upstream, but we shouldn't resurrect it:
  ```bash
  # accept both-ours-and-theirs into package.json by hand first
  rm package-lock.json
  npm install
  ```
- Double-check `scripts/start-local-mongo.mjs` is present (we need
  it; upstream introduced it to replace `run-rs`).

### 3b. Conflicts in i18n / locale files

`website/common/locales/**/*.json`:
- These are mostly additive. Take upstream's additions; keep our
  fork-only keys (anything referenced by AI chat, task-locked
  rewards, or reward actions UI). `rg` for the key in
  `website/client/` before deleting — if it's referenced, keep it.
- If the whole file is a reformat-only conflict, prefer upstream's
  formatting to stay close to their tooling.

### 3c. Conflicts in controllers we added to (API v3 tasks, API v4 tasks)

`website/server/controllers/api-v3/tasks.js` and
`website/server/controllers/api-v4/tasks.js`:

- **Known collision:** upstream `e6ffd69148` ("feat(analytics):
  initial Habitica-owned solution") removed `res.analytics.track(...)`
  call sites. Our fork-added endpoints (AI chat endpoints at
  `/tasks/:taskId/chat`, `/tasks/:taskId/ai-enable`, reward action
  endpoints at `/rewards/:rewardId/purchase-status`,
  `/rewards/:rewardId/test-webhook`) may have `res.analytics.track`
  calls copied from neighboring upstream code. **Remove those calls**
  in our fork-added endpoints too — don't keep them alive just
  because they're on "our" side of the conflict.
- Keep all AI endpoints and reward-action endpoints intact. They're
  new code, only in our fork.

### 3d. Conflicts in the score pipeline (the danger zone)

`website/server/libs/tasks/index.js`:

- This is the core task scoring pipeline. Every change must be
  understood.
- **Known collision:** upstream changed `shared.ops.scoreTask` /
  `shared.fns.randomDrop` signatures (removed the `res.analytics`
  parameter threaded through them). When resolving:
  - Adopt upstream's new signatures.
  - Our fork-added logic lives roughly at:
    - `checkUnlockedRewards(...)` near L408 (task-locked rewards)
    - Reward-lock validation on reward purchase (~L517)
    - `rewardAction` payload construction + webhook dispatch
      (~L541)
  - These do not depend on `res.analytics` — verify, but they
    should port across unchanged.
- If you see a merge mark you don't understand, stop and read the
  full function on both sides before picking a resolution. This
  file governs all scoring; a wrong merge here corrupts user data.

`website/common/script/ops/scoreTask.js` and
`website/common/script/fns/randomDrop.js`: adopt upstream's
signatures; our fork barely touches these.

`website/server/libs/cron.js`: mostly upstream. Take their changes.

### 3e. Conflicts in models

`website/server/models/task.js`:
- Keep our `aiEnabled`, `aiChatMessages`, `aiAssessmentStatus`
  fields on the task schema.
- Keep our `RewardSchema.requiredTasks`, `actionEnabled`,
  `actionType`, `actionConfig`, `lastPurchased`,
  `lastPurchasedBy`, `purchaseHistory`, `webhookLogs` fields.
- Take upstream's changes to all other task fields.
- If upstream renamed a field we extended, rename consistently on
  our side.

`website/server/models/user/schema.js`: mostly upstream. Scan for
any family-mode-related fields we might have added (unlikely at
this stage).

`website/server/models/group.js`: we plan to expand this heavily
for family mode (roadmap 03), but as of this sync it's mostly
upstream's. Take upstream.

### 3f. Everything else

Default: take upstream. If in doubt, `git show HEAD:<file>` and
`git show upstream/develop:<file>` and reason from full files, not
hunks.

### 3g. Verify before committing

```bash
git status                                     # confirm zero unmerged paths
rg -tjs "res\.analytics\.track" website/server # should be 0 hits
rg "<<<<<<<|>>>>>>>|=======" --no-ignore       # literally no conflict markers
```

If any check fails, go back and fix before committing.

## Stage 4 — Reinstall and rebuild

```bash
nvm use
npm install                     # postinstall runs gulp build + client install
npm run sprites                 # rebuild sprite sheets in case spritesheets changed
npm run apidoc                  # regenerate API docs if controllers changed
```

`npm install` failures usually mean leftover package-lock conflicts
or an unmet peer. Read the exact error — don't just `--force`.

## Stage 5 — Smoke tests

The full suite is slow. For the merge PR, this subset gives enough
signal:

```bash
npm run lint-no-fix
npm run test:common
npm run test:content
npm run test:api-v3:integration  # critical — touches score pipeline
npm run test:api-v4:integration  # critical — touches reward actions
```

Fork-added tests worth eyeballing:
- `test/api-v3/tasks/ai/*` (if present)
- `test/api-v3/tasks/rewards/*` (if present)
- anything under `test/common/` that mentions `scoreTask`

If a test fails, the instinct "maybe upstream's test was updated and
we missed it" is correct ~30% of the time and the instinct "we broke
scoring" is correct the other 70%. Don't suppress failures; fix
them.

## Stage 6 — Commit the merge

Write the merge commit message with context the PR reviewer will
need. The `merge` command was started with `--no-commit`, so:

```bash
git commit -F - <<EOF
chore(upstream): merge HabitRPG/habitica ${VERSION} into habaitica-main

Brings in <N> upstream commits since <previous-version>. Key
upstream changes we absorbed:

- <bullet per notable upstream change affecting our code>

Conflict resolutions:
- <file>: <one-line why>
- <file>: <one-line why>

Fork-custom features preserved (AI task assessment, task-locked
rewards, reward actions). Fork-added endpoints no longer call
res.analytics.track(...) — that API is gone upstream; see
roadmap 00.

[agent:upstream-sync]
EOF
```

Replace `<N>`, `<previous-version>`, and the bullets with real
values from `git log --oneline habaitica-main..upstream/develop`.
Keep the message under ~50 lines; the PR description carries the
detail.

## Stage 7 — Push and open the PR

```bash
git push -u origin HEAD

gh pr create \
  --repo <origin-owner>/habaitica \
  --base habaitica-main \
  --head "$BRANCH" \
  --title "chore(upstream): merge HabitRPG/habitica ${VERSION}" \
  --body-file - <<EOF
## Summary

Consolidates <N> upstream commits from \`HabitRPG/habitica\` (up to
\`${VERSION}\`) into \`habaitica-main\`.

Highlights from upstream:
- <bullet 3-6 items>

## Conflict zones resolved

| File | Why it conflicted | Resolution |
|---|---|---|
| \`website/server/libs/tasks/index.js\` | Upstream refactored scoreTask signature (\`e6ffd69148\`) | Adopted new signature; ported fork-added rewardAction + reward-unlock paths |
| \`website/server/controllers/api-v3/tasks.js\` | \`res.analytics.track\` removals vs. fork-added AI endpoints | Dropped \`res.analytics.track\` calls in our endpoints too |
| \`package.json\` | Upstream bumped mongoose/markdown etc. | Kept both; regenerated lockfile |
| ... | ... | ... |

## Fork features verified intact

- AI task assessment endpoints
- Task-locked rewards
- Reward actions (webhook/push/API polling)

## Test plan

- [x] \`npm run lint-no-fix\`
- [x] \`npm run test:common\`
- [x] \`npm run test:content\`
- [x] \`npm run test:api-v3:integration\`
- [x] \`npm run test:api-v4:integration\`
- [ ] Manual smoke: create a task, score it, purchase a reward with \`requiredTasks\`, toggle AI assessment on, run a chat round-trip.

Per roadmap 00, the merge is kept as a single merge commit (no
rebase) so future three-way diffs remain tractable.

[agent:upstream-sync]
EOF
```

Leave the PR open for human review. Do not merge it — that's a human's
call, and `habaitica-main` is protected.

## Stage 8 — Post-merge housekeeping (after the human merges)

After the PR is merged:

- `git checkout habaitica-main && git pull --ff-only origin habaitica-main`
- Delete the merge branch locally and on origin (`git branch -d`,
  `git push origin --delete`).
- Update the Current Status table in
  `roadmaps/00-branching-and-upstream-sync.md` with the new
  upstream-parity version.
- If any upstream change materially advances or deprecates a roadmap
  item, update the relevant roadmap too (separate PR, not part of the
  merge).

## Anti-patterns — don't do these

- **Don't rebase `habaitica-main` onto `upstream/develop`.** It
  destroys shared history and will force-push-reject against the
  protected branch anyway.
- **Don't squash-merge the upstream PR.** Same reason — we want
  upstream's commits visible in our `git log` for future bisects.
- **Don't fix test failures by deleting the tests.** If a test that
  exercises our fork code breaks, it's because the merge broke our
  code, not because the test was wrong.
- **Don't resurrect `res.analytics.track`** anywhere — it's gone
  upstream, and our fork-added call sites need to go too. We'll
  migrate to the new analytics surface later (roadmap 00 open items).
- **Don't bypass branch protection.** If the PR is blocked, ask the
  human to review; don't push to main directly even as admin.

## Quick reference — files in the known danger zone

| File | Why it's risky |
|---|---|
| `website/server/libs/tasks/index.js` | Score pipeline + fork reward-action hooks |
| `website/server/libs/cron.js` | Runs daily for every user |
| `website/server/controllers/api-v3/tasks.js` | All task REST + fork AI endpoints |
| `website/server/controllers/api-v4/tasks.js` | Bulk score + reward action endpoints |
| `website/server/models/task.js` | Schemas for habit/daily/todo/reward + all fork extensions |
| `website/common/script/ops/scoreTask.js` | Shared scoring op, signature changed upstream |
| `website/common/script/fns/randomDrop.js` | Shared drop op, signature changed upstream |
| `package.json` / `package-lock.json` | Dep reconciliation |

## When this skill itself is out of date

If you find a new class of conflict that isn't described here (e.g.
upstream introduces a new subsystem that tangles with a fork feature),
update this skill as part of the same PR or a follow-up. Future syncs
should inherit the lesson. Also reflect the learning in
`roadmaps/00-branching-and-upstream-sync.md` under "Known conflict
zones".
