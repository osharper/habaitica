# 05 — Brand Identity and Owned Content

**Goal:** Turn Habaitica from "a Habitica fork you happen to run" into a
product with its own name everywhere, its own visual identity, and its
own art assets that the project actually owns and can relicense.

Two intertwined tracks:

1. **Full rebrand** — `package.json#name` is done; every other
   user-visible "Habitica" string has to follow.
2. **Owned art & content** — the `habitica-images` submodule is under a
   different license than the code. We pin it today and commit to
   replacing it with Habaitica-original art over time.

Both tracks matter for eventual distribution: a commercial / hosted
offering can't ship user-visible "Habitica" strings we don't have
permission for (trademark), and can't redistribute upstream art outside
the terms of its license.

## Track A — Full rebranding

### Current state

- [DONE] Repo renamed to `habaitica`.
- [DONE] Default branch renamed to `habaitica-main`.
- [DONE] `package.json#name` → `habaitica`, `package-lock.json` regenerated.
- [DONE] `package.json#description` updated to reflect the fork identity.
- [DONE] `NOTICE.md` at repo root declares fork status, upstream credit,
  and trademark posture.

### What still says "Habitica" / "habitica"

A quick `rg -i habitica` returns thousands of hits. Most are legitimate
(we are a Habitica fork, in `NOTICE.md`, etc.); a specific subset is
user-visible or product-branding and must change. Rough inventory:

| Surface | Examples | Rebrand? |
|---|---|---|
| Emails | `website/server/libs/email.js`, Mandrill templates, footer signatures | **Yes** |
| Product-name strings in UI | `common/locales/*/*.json` keys like `habiticaDescription`, `welcomeToHabitica`, page `<title>` | **Yes** |
| Push-notification copy | `website/server/libs/pushNotifications.js` | **Yes** |
| OG / meta tags, PWA manifest | `website/client/public/manifest.json`, `<meta>` tags in index.html | **Yes** |
| Docker image tags | `docker-compose.dev.yml`, `Dockerfile*` | **Yes** |
| Analytics `registeredThrough` values | `'habitica-web'`, `'habitica-ios'`, `'habitica-android'` | Migrate (keep old values decodable) |
| API error codes, i18n keys with `habitica` prefix | `habitica.stripe.*`, etc. | **Keep** (internal IDs; renaming breaks consumers) |
| Code references to the upstream project | comments, doc links, `NOTICE.md`, PR templates | **Keep** (these are legitimate upstream credit) |
| Third-party integrations | Stripe product names, Google OAuth consent screen, Apple IAP, Firebase project | **Migrate** (requires operator work) |

### Phased plan

**Phase 1 — Internal metadata (shipped in this decisions PR)**

- `package.json#name`, `description`.
- `NOTICE.md`.

**Phase 2 — User-visible UI strings**

- [TODO] Sweep `website/common/locales/en/*.json` for product-name
  strings. For each key, decide: keep ("Habitica") because it refers
  to the upstream project we credit, or rebrand ("Habaitica") because
  it brands *our* product.
- [TODO] Create a one-shot `scripts/rebrand-locales.js` that applies
  the decision table across all locales so translators don't each
  re-derive it.
- [TODO] Update page `<title>`, PWA manifest `name` / `short_name`,
  OG `<meta>` tags.
- [TODO] Logo/icon replacement (see Track B).
- Open question: do we rebrand *translated* strings or wait for
  volunteer translators? Recommend: ship English, leave others as
  "Habitica" until contributors propose translations, per-locale.

**Phase 3 — Transactional surfaces**

- [TODO] Email templates — subject lines, footer signatures, brand
  color. This is Mandrill/Mailgun template work; needs operator
  access to the provider.
- [TODO] Push notifications — `pushNotifications.js` strings.
- [TODO] Receipt/billing text (if we ever charge).

**Phase 4 — Infrastructure & integrations**

- [TODO] Docker image names.
- [TODO] Create our own Firebase / Apple / Google OAuth apps under
  "Habaitica". Keep upstream apps configured in parallel until
  migration is verified. These are operator tasks.
- [TODO] Add `registeredThrough` values `'habaitica-web'`,
  `'habaitica-ios'`, `'habaitica-android'`; leave the existing
  values as-is in historical records.

**Phase 5 — Cleanup**

- [TODO] `rg -i habitica` one more time; everything that remains
  should be legitimate upstream credit, package dependency, or
  documentation.

### Non-goals

- Renaming API error codes or existing i18n keys (breaks clients
  silently; not worth the churn).
- Asking translators to retranslate the entire product before Phase 2
  is even stable in English.

## Track B — Owned art & content

### Why we can't just keep using `habitica-images`

The `habitica-images` submodule is governed by its own license, which
is more restrictive than GPLv3 (non-commercial-leaning, restrictions on
brand identity). That's fine for running our own family instance, but
it blocks:

- Any commercial distribution.
- Relicensing fork-only art (we'd be mixing incompatible terms).
- Trademark independence (several assets incorporate Habitica-branded
  iconography).

### Current state

- [DONE] Submodule pointer **pinned** at the commit we merged to on
  2026-04-20. It will not auto-update on upstream merges; the
  `upstream-sync` skill and `roadmaps/00` both record this.
- Runtime consequence: new gear/pets added upstream will render as
  missing-asset placeholders in Habaitica until we explicitly choose
  to bump the pointer *or* replace the asset with our own.

### Target end state

- A new repository `osharper/habaitica-images` (or sibling under the
  workspace) containing only art we own.
- Every sprite served by Habaitica resolves to an asset in the owned
  repo first, falling back to the pinned upstream submodule only for
  assets we haven't replaced yet.
- Licensing of the owned repo: **CC-BY-SA 4.0** (tentative — matches
  the spirit of GPLv3 for assets; finalize in the art track below).

### Phased plan

**Phase 1 — Asset inventory & dependency mapping** `[TODO]`

- Enumerate which sprites, avatars, UI icons, and background images
  Habaitica actually uses at runtime. A significant portion of
  `habitica-images` is content we haven't touched (classes, mounts
  for quests we don't run, etc.).
- Classify each used asset by "must replace" (brand logo, hero UI,
  anything that says "Habitica") vs. "can defer" (flavor pets,
  seasonal gear).

**Phase 2 — Asset loader seam** `[TODO]`

- Today sprites are served from the `habitica-images` submodule
  directly. Introduce an asset resolver: given a sprite key, return
  the first of { owned asset, pinned-upstream asset, placeholder }.
- This is a pure refactor; zero user-visible change until we start
  replacing assets.

**Phase 3 — Brand-critical art** `[TODO]`

- App logo, icon, favicon, PWA icons, login page hero.
- Commission or generate (see tooling below) + human design pass.

**Phase 4 — Gradual replacement** `[TODO]`

- Replace in priority order: UI iconography, core class avatars,
  then the long tail of gear/pets/mounts.
- Each replacement PR: adds the owned asset, flips the resolver
  config, leaves the upstream asset available as fallback for
  older clients.

**Phase 5 — Cut the submodule** `[TODO, long-term]`

- Once every runtime-referenced asset has an owned equivalent,
  delete the `habitica-images` submodule. Keeps the repo GPLv3 pure
  and fully redistributable.

### Tooling (open)

- Generation: nano banana pro or similar image model, consistent seed
  + style guide + human review. Assets produced this way must be
  documented as AI-assisted in the asset repo.
- Style guide: TBD. Starting point — pick a palette and line-weight
  language that differs meaningfully from Habitica's while remaining
  legible at sprite sizes.
- Review cadence: asset PRs follow the same `agent/<name>/<topic>`
  branch convention and require a human approver who can actually
  *look* at the art.

### Non-goals

- Waiting for a "complete" owned library before shipping any owned
  assets. Track B ships incrementally; partial coverage is fine as
  long as the resolver cleanly falls back.
- Re-implementing upstream's content pipeline. Habaitica uses
  upstream content semantics (gear stats, pet behaviors); only the
  *images* need to be ours.

## Interaction with other roadmaps

- Roadmap 00 — now references this doc for Q2 (naming) and Q4
  (submodule pin + own-art plan).
- Roadmap 03 — family-centric features should use owned art where
  kids will actually see it (login, dashboards).
- Roadmap 04 — agentic development: asset generation is a candidate
  agent specialization ("art-generator" subagent).

## Open questions

- **Q1. Translator coordination.** Phase 2 rebrand touches locale
  files. Do we freeze translations during the sweep or accept drift?
- **Q2. Asset license.** CC-BY-SA 4.0 is the current proposal; confirm
  before we start commissioning art.
- **Q3. Budget.** Track B either costs staff time (generation + review)
  or money (commissioning). Which?
- **Q4. Fallback policy at runtime.** If an asset is missing from both
  owned and upstream, do we render a placeholder, hide the element,
  or block the page? (Recommend placeholder + logged warning.)
