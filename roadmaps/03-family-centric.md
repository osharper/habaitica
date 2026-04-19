# 03 — Family-Centric Transformation

**Goal:** Habitica's group / party features are gated behind the paid
"Group Plans" subscription (`hasActiveGroupPlan()`). In Habaitica we want
them **free and default**, and reshaped around a household/family
model — shared dailies, managed rewards, kid-oriented UX — rather than
an MMO guild.

Depends on: roadmap 00 (branching — upstream touched groups a lot) and
roadmap 02 (real-life rewards have a family permission model).

## Landscape in the codebase today

### The group-plan gate

The string `hasActiveGroupPlan()` appears in **10 server files** and
silently behind a dozen more features:

| Gate site | What gets gated |
|---|---|
| `website/server/libs/chat/group-chat.js` | Slash-command access, who can chat in guilds |
| `website/server/controllers/api-v3/hall.js` | Which groups show as "group plans" |
| `website/server/libs/payments/subscriptions.js` | Recipient subscription upgrade perk |
| `website/server/libs/challenges/index.js` | Guild challenges (paid) vs. party (free) |
| `website/server/libs/invites/index.js` | Invite copy changes based on plan status |
| `website/server/models/challenge.js` | Group challenges require active plan |
| `website/server/models/user/methods.js` | `canGetGems` / subscription gem grants |
| `website/server/controllers/api-v3/groups.js` | Group listing & manager mechanics |
| `website/server/models/group.js` | Schema `leaderOnly`, member-limit overrides, `updateGroupPlan` |
| `website/server/libs/tasks/index.js` | Team-task scored analytics |

Plus on the client: `website/client/src/components/group-plans/billing.vue`,
`shops/`, `settings/subscription.vue`, `header/userDropdown.vue`,
`shops/buyModal.vue` check for group-plan status to switch UI.

### Existing multi-user primitives we can reuse

- **Groups** already have `type: 'party' | 'guild'`, `leader`, `managers`,
  `privacy: 'public' | 'private'`, `leaderOnly.chat` / `leaderOnly.getGems`
  / etc.
- **Party** is a free 30-member group (`PARTY_LIMIT_MEMBERS = 30` in
  `website/common/script/constants.js`) intended for questing together.
- **Group tasks** — tasks assigned to groups (`task.group.id`) and then
  synced to individual members with per-user completion tracking
  (`group.assignedUsersDetail`). Lives in `website/server/models/group.js`
  around line 1382.
- **Challenges** — a shared bundle of tasks that group members can join
  and track independently. Already exists in full.
- **Manager role** — `group.managers = { [userId]: true }` with
  `group.leader` as super-admin. Already wired to chat moderation + task
  assignment.
- **Invites** — invite-by-username / invite-by-email plumbing is complete.
- **Chat reporting + moderation** — full pipeline in `libs/chatReporting/`.

Almost every **feature** we need for a family already exists; it's just
gated.

## Work items

### Phase 1 — Ungate (smallest surgery, largest UX win) [TODO]

Principle: change one function's return value and audit.

- [TODO] Introduce a feature flag `FAMILY_MODE_ENABLED` (nconf) defaulting
  to `true` in Habaitica.
- [TODO] Create a helper `isFamilyMode()` in a new file
  `website/server/libs/family/index.js` that centralizes the decision.
- [TODO] Replace direct `group.hasActiveGroupPlan()` calls in the
  gate sites above with a new helper
  `effectiveGroupPlanActive(group)` that returns `true` if
  `isFamilyMode() || group.hasActiveGroupPlan()`.
- [TODO] Audit each gate site to confirm the behavioral change is what
  we want (some should *stay* gated — e.g. billing).
- [TODO] Client-side: introduce a Vuex getter `isFamilyModeActive` and
  replace `group.purchased.plan.customerId` checks on the client with
  that getter.
- [TODO] Hide the "Upgrade to Group Plan" CTA everywhere when family
  mode is active (`group-plans/billing.vue`, `buyModal.vue`,
  `userDropdown.vue`).
- [TODO] Keep the old code paths behind the feature flag so we can
  still merge upstream changes that touch them without semantic drift.

### Phase 2 — Re-shape "Group" as "Family" [TODO]

- [TODO] Introduce a new `type: 'family'` group discriminator (additive,
  doesn't break parties or guilds). Family has:
  - Free + always-on "group plan" behaviors (task assignment, shared
    tasks, managerial tools).
  - Max 10 members (configurable per deployment).
  - Uses real names preferred over Habitica usernames.
  - Has explicit roles: **Parent / Guardian** (maps to `manager` +
    optionally `leader`), **Child** (regular member), **Teen** (child
    with more autonomy — see Phase 4).
- [TODO] "Create a family" onboarding flow replacing "Invite your party".
  First-run wizard: name your family, invite members (email + name +
  role + age bracket), done.
- [TODO] First-class **family dashboard** page (new route
  `/family/<id>`) with:
  - Everyone's status at a glance (streaks, today's dailies, pending
    rewards).
  - Quick assign-task row.
  - Pending approvals tray (reward claims requiring parent sign-off
    — see roadmap 02).
- [TODO] Rename strings from "Guild leader" / "Party manager" to
  "Parent" / "Guardian" when the group is family-typed. Leverage the
  localization rework upstream shipped in 5.44.

### Phase 3 — Family-shared resources [TODO]

Habitica already has group-assigned tasks; we want more.

- [TODO] **Shared rewards pool** — a reward owned by the family, not a
  single user. Any member can "buy" it with their own gold; with a
  flag, gold can be drawn from a shared family wallet.
- [TODO] **Family gold** — a separate gold ledger at the group level
  (`group.familyGold`). Parents can grant gold for chores outside
  Habitica.
- [TODO] **Shared todo list** — today group-tasks get synced to every
  member's personal list; add a "one-claim" mode where the first
  person to check off the task is the one who "gets it" (handy for
  "take out the trash").
- [TODO] **Recurring family goals** — e.g. "read 5 books this month as
  a family" — aggregates over all members' task completions.
- [TODO] **Shared shopping list / grocery task type** — opinionated
  extension of the todo type, for family logistics.
- [TODO] **Family pet / quest** — cosmetic: a family-wide quest bar
  that fills as members complete dailies. Builds communal feeling.

### Phase 4 — Roles & age-aware UX [TODO]

- [TODO] `user.familyProfile = { role, ageBracket }` where
  `ageBracket ∈ { 'under_6', '6_12', '13_17', 'adult' }`. Age brackets
  dictate UI affordances; exact birthday is never required.
- [TODO] Kid UI: fewer menu items, bigger icons, strip the
  Tavern/Guilds/World-Quest content that's not appropriate or
  interesting to them.
- [TODO] **Parent override**: a parent can score/undo any child's task.
  Backend: managers can already edit group tasks; extend to personal
  tasks of their family members.
- [TODO] **Chat safety**: family chat uses existing chat moderation,
  but with pre-moderation for under_13 if desired. Already have
  `bannedWords.js` and `bannedSlurs.js` infrastructure.
- [TODO] **Allowance schedule** — weekly automatic gold grants per
  child, editable by parents (Phase 3 ledger required).

### Phase 5 — Onboarding the whole family [TODO]

- [TODO] Single magic-link invite that registers the invitee, assigns
  them to the family, and walks them through their first task.
- [TODO] Parent-created account for under-13 kids (COPPA-safe):
  no email required, parent is custodian, no public profile, no
  Tavern/Guild discovery.
- [TODO] **Household import**: bring all the chores from a Google
  Keep / Todoist list into the family as a shared task set.
- [TODO] QR-code login between family members' phones (parent approves
  kid joining).

### Phase 6 — De-gamifying the social parts [TODO]

Habitica's public game layers (Tavern, World Boss, Hall of Heroes,
Guilds, Challenges lookup) aren't what a family wants. Hide, but
don't break them.

- [TODO] **"Private family server" mode**: deployment-level flag that
  disables all public discovery. `/groups/discover` returns only the
  user's family; Tavern/World Quest disabled; Hall of Heroes hidden.
- [TODO] Keep guild challenges available within the family (they're
  well-designed), but rename "Challenges" to "Missions" in family UI.
- [TODO] Retain existing notification types for questing but suppress
  the shoutouts ("Jane just leveled up!") unless the member opts in
  — kids often find level-ups addictive; configurable.

## Data-model migration plan

- [TODO] Additive fields only, never destructive:
  - `group.type: 'family'` (new enum value, not a rename).
  - `user.familyProfile` (new subdoc).
  - `group.familyGold` (default 0).
- [TODO] Backfill script: promote the leader's existing party → family
  if the user opts in via onboarding.
- [TODO] Keep compatibility with Habitica's Android/iOS apps — they'll
  see a family as a "party", which is tolerable until our apps ship.

## Payments, quotas, and Gems

The whole free-by-default approach breaks the Gems economy assumptions.

- [TODO] **Gems**: Habitica gives group-plan leaders gems periodically
  (`canGetGems` in `user/methods.js`). Decide whether Habaitica
  deployments hand out gems freely, disable the gem economy entirely,
  or expose gems as an admin-configurable allowance per child.
- [TODO] Hide all "Buy Gems" CTAs in family mode (client-side gating).
- [TODO] Long term: expose a household-admin panel to set allowances
  and quotas; monetization (if any) should be deployment-level, not
  in-app.

## Security / privacy considerations

- [TODO] Children's data: store minimum needed, no birthday required,
  no public-profile default. Align with COPPA / GDPR-K.
- [TODO] Managers can view *but not edit* a family member's private
  notes or diaries; only tasks + rewards.
- [TODO] Audit existing chat/report plumbing for minors — make sure
  "report to admin" routes go to the family's leader, not Habitica
  staff.
- [TODO] Revocation: when a child leaves a family (age out, divorce,
  school switch), preserve their data + let them export it.

## Open questions

- **Q1. Upstream relationship.** Ungating features silently diverges
  from Habitica's business model. When we pull upstream changes that
  touch `hasActiveGroupPlan()`, we'll conflict repeatedly. Is our
  long-term plan to **stay a soft fork** (merge regularly, keep the
  gate helper ours) or **hard fork** and stop merging once upstream
  payments code changes too heavily?
- **Q2. Visibility to Habitica the company.** We're publishing a
  derivative work with a ungated version of their paid features. Is
  that within the letter and spirit of their license? Worth a chat
  before any public launch.
- **Q3. Do we keep the fantasy layer at all?** A household will either
  (a) love the RPG aesthetic (engagement for kids) or (b) find it
  noisy. Should we make the whole class/quest/gear system optional via
  a deployment flag? That's a big lift: most of the UI assumes it.
- **Q4. Family-wide parties vs. household-only.** Parents in different
  physical households (joint custody, grandparents) may want
  overlapping families. Can a user belong to multiple families at
  once? Habitica's group model handles multi-group membership, but
  the assignments / allowance logic would need scoping.
- **Q5. Teen autonomy.** Kid under 13 vs. teen have very different
  needs. Can a teen opt into an adult-like experience while still
  being in the family? Specifically: can they join public guilds if
  a parent allows it?
- **Q6. Allowance economy.** If "real gold" (family wallet with USD
  behind it) is too spicy, keep everything abstract gems-only?
  Ties into roadmap 02's physical-reward question.
- **Q7. Multi-tenancy.** Habaitica self-hosting for one family is
  easy; hosting many families on one instance needs clearer tenant
  isolation. Worth planning now or deferring?
- **Q8. Guilds vs Families.** Upstream Guilds have their own
  subscription flow (group plan on a guild). If a user is in a family
  *and* an upstream-style paid guild, what wins? Probably: guild
  keeps its plan, family ungates independently.
- **Q9. Calendar integration.** Family scheduling is 80% of household
  coordination. Should we bake in an iCal/Google Calendar sync (scope
  creep but high value) or stay laser-focused on tasks?
- **Q10. Localization priorities.** Which languages do we prioritize
  for family-mode strings? Upstream supports 30+; re-translating all
  our new strings is expensive. Ship English + Russian first?
