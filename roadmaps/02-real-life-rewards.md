# 02 — Real-Life Rewards

**Goal:** Turn Habaitica rewards into actual real-world actions: unblock a
device for N minutes, unblock the home network, dim the lights + start a
movie, ping a custom webhook, etc.

Status snapshot: **Core engine exists** (generic reward-action framework is
already shipped). What remains is **actually wiring up the real-world
integrations** behind it — screen-time providers, routers, smart-home
platforms — plus the UX and safety work to make it family-ready.

Depends on: roadmap 00 (branching), and roadmap 03 (family) for the
permission model around "who can claim" / "who approves".

## What already exists in the codebase

### Generic reward-action engine [DONE]

- [DONE] Reward schema extensions in
  `website/server/models/task.js` (`RewardSchema`, lines ~436–497):
  - `actionEnabled: Boolean`
  - `actionType: 'client_action' | 'webhook' | 'api_polling' | 'multiple'`
  - `actionConfig.clientAction` (action key, duration, devices list,
    customPayload)
  - `actionConfig.webhook` (url, method, headers, body template,
    timeout)
  - `actionConfig.apiPolling.enabled`
  - Purchase tracking: `lastPurchased`, `lastPurchasedBy`,
    `purchaseHistory[]` (last 10), `webhookLogs[]` (last 20).
- [DONE] Purchase pipeline in `website/server/libs/tasks/index.js`:
  - Builds a `rewardAction` payload on reward-score-up.
  - Executes webhooks server-side via
    `executeWebhook(webhookConfig, context)` in `libs/webhookUtils.js`.
  - Logs webhook success/failure to `webhookLogs[]`.
  - Sends a push notification (`identifier: 'rewardAction'`) to mobile
    apps for client actions.
- [DONE] API endpoints in `website/server/controllers/api-v4/tasks.js`:
  - `GET /api/v4/rewards/:rewardId/purchase-status` — for API polling
    (returns `lastPurchased`, `purchasedToday` respecting `dayStart`,
    `minutesSincePurchase`, and `actionConfig.duration`).
  - `POST /api/v4/rewards/:rewardId/test-webhook` — dry-run.
- [DONE] Frontend: reward action configuration UI is merged into
  `website/client/src/components/tasks/taskModal.vue`; score-flow
  mixin `website/client/src/mixins/scoreTask.js` handles the returned
  `rewardAction` payload.
- [DONE] Specs + task lists live at `REWARD_ACTIONS_SPECIFICATION.md`
  and `REWARD_ACTIONS_TASKS.md` — those docs should be considered
  reference material and superseded by this roadmap for forward planning.

### Gaps in the existing engine [TODO]

- [TODO] No **retry** on webhook failure. One 5xx and it's gone.
  Proposal: exponential backoff queue, hand off to a worker
  (`website/server/libs/worker.js` already exists).
- [TODO] No **signing / shared-secret** on outgoing webhooks —
  receivers can't verify the request really came from Habaitica.
- [TODO] No **idempotency key** on webhook delivery; retries could
  trigger an action twice.
- [TODO] No **rate-limit per reward** — a spammy reward click could
  nuke a home-automation endpoint.
- [TODO] API polling returns minutes since purchase but no
  **signed token** — any client can poll if it knows the reward id.
- [TODO] `webhookLogs[]` caps at 20 entries and lives inside the task
  document; large families will want a separate `rewardActionLog`
  collection.
- [TODO] No concept of **"action running" vs. "action completed"** —
  the duration is in the payload but the server doesn't track whether
  the unblock actually happened or was reverted.
- [TODO] Nothing ties a **cooldown** to a reward — should be
  purchasable at most once per hour/day/etc. Exists as `dayStart`
  context but not enforced.

## Roadmap — by integration class

### Integration 1 — Generic webhooks (production-hardened) [MOSTLY DONE]

- [DONE] Config UI, test-webhook endpoint, server-side delivery.
- [TODO] **Signing**: HMAC-SHA256 over body with a shared secret that
  the user configures per webhook. Standard `X-Habaitica-Signature`
  header.
- [TODO] **Idempotency**: include `X-Habaitica-Delivery-Id` (UUIDv4);
  receivers can dedupe.
- [TODO] **Retry queue**: push failed deliveries onto Redis list,
  worker drains with 1/5/30/120s backoff, gives up after 5 attempts
  and emails the owner.
- [TODO] **Templating**: already uses variable substitution in body;
  upstream added `micromustache` dep (`5f67e4a0ea`) — consider
  adopting that for safer templating than whatever's there now.
- [TODO] Expose webhook logs UI (today they're only in the doc).

### Integration 2 — Custom API polling [MOSTLY DONE]

- [DONE] `GET /rewards/:id/purchase-status` endpoint.
- [TODO] **Auth**: today the endpoint requires standard session auth
  (`authWithHeaders`). A router firmware needs a long-lived token.
  Add a per-reward "polling token" (or reuse Habitica API tokens).
- [TODO] **Standardize response schema** — document it as
  `/openapi.yaml` so router/script authors can code against it.
- [TODO] Provide a **reference OpenWrt/Lua script** that polls this
  endpoint every 30s and opens a firewall window for
  `actionConfig.duration` minutes when `purchasedToday` flips to true.
- [TODO] Subscribe via Server-Sent Events instead of polling — cuts
  latency for "unblock *now*" and reduces router load.
- [TODO] Multi-device polling: one reward → many routers (work vs.
  home). Today `actionConfig` is one-dimensional.

### Integration 3 — Screen time (iOS Family Controls)

iOS path is the hardest because it's all mediated through Apple's
frameworks and requires either a companion app or an MDM profile.

- [TODO] **Choose a delivery vehicle** (see Open Questions):
  a) Ship a tiny native companion app ("Habaitica Family Bridge")
     that holds the Family Controls entitlement and listens for APNS
     push notifications from our `rewardAction` push pipeline.
  b) Integrate with an existing 3rd-party product (Screen Time API
     from screentimeapi.com, Jamf, Apple Business Manager) and drive
     it from our server.
- [TODO] If (a): request the Family Controls entitlement from Apple
  (multi-week review). Parent authorizes once via Family Sharing.
- [TODO] APNS side: our `sendPushNotification({..., identifier:
  'rewardAction', category: 'rewardAction', payload })` already fires.
  Need a new `category` handler in the iOS companion that maps
  `action: 'unblock_device'` → `ManagedSettings.store.shield.applications.remove(...)`.
- [TODO] On-device timer to re-shield after `duration` minutes.
- [TODO] Safety: **default-deny** list of bundle ids that can *never*
  be unblocked (banking, education apps), stored in parent settings.
- [TODO] Audit log on the device so we can reconstruct when a kid's
  phone was unlocked, even if the server request was tampered with.

### Integration 4 — Screen time (Android)

Android has no equivalent Family Controls. Options:

- [TODO] **Companion app with accessibility/usage permissions** —
  Android's `SYSTEM_ALERT_WINDOW` + `PACKAGE_USAGE_STATS` + a
  foreground service that overlays blocked apps. The OSS Flutter
  plugin `flutter_screentime` is a proven starting point.
- [TODO] **Google Family Link integration** — no official third-party
  API, but we can deep-link into Family Link when a reward is
  claimed and ask the parent to grant bonus time manually. Lame but
  truly safe.
- [TODO] Enterprise / Managed Google Play route for households with
  existing MDM.
- [TODO] Decide whether to share the iOS companion code
  (Kotlin-Multiplatform?) or keep them separate.

### Integration 5 — Router-level internet blocking (OpenWrt)

This is the integration that got the most design attention in the existing
spec. We already have API-polling scaffolding.

- [TODO] **Ship a reference OpenWrt package** `habaitica-gatekeeper`:
  - Lua/Shell script installed in `/etc/init.d/habaitica-gatekeeper`.
  - Config in `/etc/config/habaitica` with API base URL, token,
    list of MAC → reward mappings.
  - Polls every 30s (or subscribes to SSE once implemented).
  - On `purchasedToday=true` & `minutesSincePurchase < duration`,
    adds an `iptables` ACCEPT rule; otherwise drops.
  - Logs to `/var/log/habaitica-gatekeeper.log`.
- [TODO] Alternative **SSE-first** flavour that keeps a long-lived
  HTTPS connection to Habaitica; useful on mobile-tethered routers.
- [TODO] Document the Gatekeeper-style Telegram approval flow
  (see 2026 OpenWrt ecosystem) — not in scope but fun to reference.
- [TODO] **Cloud-free mode**: for families who self-host Habaitica on
  the home network, the router just talks to the local server over
  the LAN. Add a mode that skips TLS cert checks for
  `http://habaitica.lan:3000` (feature-flagged, local-network-only).
- [TODO] **Other router firmwares**: pfSense / OPNsense package as a
  stretch goal.

### Integration 6 — Smart home (Home Assistant)

Home Assistant already takes webhooks fine — but we can be more
idiomatic than a raw POST.

- [TODO] **Publish a Home Assistant custom integration**
  (`habaitica_rewards`) that exposes:
  - `sensor.habaitica_<reward_name>` — boolean purchased-today state.
  - `event.habaitica_reward_purchased` — fires on every purchase
    with payload (reward name, user, duration).
  - Authenticates to Habaitica with a long-lived token, either
    polls `/rewards/:id/purchase-status` or subscribes to the SSE
    stream (once implemented).
- [TODO] **Out-of-box blueprints** for common scenarios:
  - "Movie night": dim lights, turn on TV scene, send
    chromecast command.
  - "Gaming hour": enable PS5 power outlet, mute living room
    speakers.
  - "Quiet reading": enable library lights, turn off TV.
- [TODO] Direct Matter/HomeKit/Google Home integration is out of
  scope — Home Assistant bridges all of them.
- [TODO] For Apple HomeKit purists: **HomeKit Shortcut** template
  that polls our status endpoint using iOS Shortcuts.

### Integration 7 — Other "webhook-first" services (easy wins)

These are just documented templates built on the existing webhook engine.

- [TODO] **Spotify** — pause/play via webhook → Spotify Connect API
  through a small proxy.
- [TODO] **Slack / Discord** — post a celebration message when a
  reward with `socialShare: true` is claimed.
- [TODO] **IFTTT / Zapier / n8n** — templates for each.
- [TODO] **Printer (label maker)** — print a reward voucher.
  (Surprisingly popular in the kid-reward space.)

### Integration 8 — Physical rewards (stretch)

- [TODO] **NFC / QR voucher** — reward purchase generates a one-time
  code the kid shows to a parent; parent's Habaitica app scans and
  confirms → triggers the action. Fills the gap for non-digital
  rewards ("ice cream after dinner").
- [TODO] **Cash/allowance integration** — webhook into a banking API
  (Greenlight, GoHenry, Revolut Kids) to transfer weekly allowance
  when a "Save $5" reward is purchased.

## Cross-cutting work

### Permissions & approval model [TODO]

- [TODO] "This reward requires parent approval" flag. When a kid claims
  it, create a pending action + push notification to managers/leaders,
  execute only after approval.
- [TODO] Per-reward spend caps ("max 3 purchases / week").
- [TODO] Budgeting: each kid has a "weekly screen time budget" that
  reward purchases draw from; surface the remaining budget in the
  reward card.
- [TODO] Audit log visible to parents across the family.

### Observability [TODO]

- [TODO] Move `webhookLogs[]` out of the task document into a
  `RewardActionLog` collection with indexes by user / reward / date.
- [TODO] Dashboard: "last 30 days of reward actions" per family.
- [TODO] Metrics: webhook p50/p95, push-delivery success rate.

### Security [TODO]

- [TODO] All outgoing webhooks must be HTTPS in production; allow
  HTTP only with `NODE_ENV=development`.
- [TODO] SSRF protection on webhook URLs — block RFC1918 /
  link-local / localhost targets unless an env flag permits it
  (useful for home-self-host).
- [TODO] Parent override on any reward purchase within 60 seconds
  (rollback the action). For iOS that means our companion must
  handle a "cancel" push that re-shields.

### Testing

- [TODO] `mitmproxy`-based integration test that asserts webhook
  signature, idempotency headers, retry timing.
- [TODO] Canary reward that fires daily at 3am to a heartbeat
  webhook so we catch deploy regressions.

## Open questions

- **Q1. iOS companion app strategy.** Build our own (multi-week
  Apple-review gauntlet, expensive to maintain) vs. partner with an
  existing parental control vendor (revenue share, less control) vs.
  punt on screen-time blocking and only support router-level blocking
  (simpler, but a phone on cellular data bypasses it). Recommend a
  Phase 1 ship with router-only, Phase 2 companion-app.
- **Q2. How do we prove identity to a router?** Reward-specific token
  that's displayed once on reward creation, stored in the router's
  config? Or an OAuth-device-flow pairing screen? First is simpler,
  second is more revocable.
- **Q3. Should the server *execute* actions or just *announce*
  them?** Today client-action lives on the mobile device (good for
  permissions) and webhook/apiPolling live on the server (good for
  reliability). If a kid's phone is off, a webhook-triggered
  unblock still happens. That's probably correct, but surface the
  semantics in the UI.
- **Q4. Multi-child, one device.** If mom + daughter share the iPad,
  a "daughter's 30 minutes of gaming" reward shouldn't unblock mom's
  TikTok. Need a per-user device profile at the OS level — possible
  on iOS with Managed Settings per child, trickier on Android.
- **Q5. Reward-chaining.** Can one reward purchase *itself* be the
  trigger for another? Useful for "bundle deals". Adds complexity
  and cycle-risk; probably phase 3+.
- **Q6. Offline kids.** Kid's device is offline when they complete
  the task. Should the reward still be claimable via SMS / parent's
  phone? Need an "out-of-band claim" escape hatch.
- **Q7. Data residency.** Some households will insist on EU-only
  hosting (kids' data). Our Gemini calls send prompts to Google
  US-based endpoints. Document and expose an EU-region toggle for
  the Gemini provider.
- **Q8. Monetization.** The upstream group-plan pricing model
  probably doesn't apply to our fork. Do we charge per family for
  cloud hosting, or ship self-host docs and stay free? Affects which
  integrations we're willing to invest in.
- **Q9. Pushing to mobile when app is uninstalled.** APNS/FCM gets
  silently dropped; we need a fallback to an SMS / email nudge.
