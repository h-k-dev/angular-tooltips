# @h-k-dev/angular-tooltips

[![npm version](https://img.shields.io/npm/v/@h-k-dev/angular-tooltips.svg)](https://www.npmjs.com/package/@h-k-dev/angular-tooltips)
[![CI/CD](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml/badge.svg)](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!WARNING]
> **Experimental — Chromium only.** This library is built on bleeding-edge platform features
> (CSS Anchor Positioning, `position-visibility`, anchored container queries, and
> [Interest Invokers](https://developer.chrome.com/blog/interestfor)) that are currently only
> supported in Chrome and other Chromium-based browsers. There is **no fallback** — the
> directive throws where the platform can't deliver. Expect breaking changes while the
> underlying specs and this API settle.

Modern, anchor-native tooltips for Angular. One singleton popover element, **zero JS in the
hot path**:

- **Triggering** is Interest Invokers (`interestfor`): the browser owns hover, keyboard
  focus, touch long-press and delays — no event listeners, no timers.
- **Positioning** is CSS Anchor Positioning: placement, viewport flipping, tail direction
  and scroll tracking are all browser CSS — no rect reads, no scroll listeners.
- **The library's whole runtime job**: render the content (string or lazily stamped
  template) and move ONE `anchor-name` onto whichever trigger holds interest.

**[Live demo →](https://h-k-dev.github.io/angular-tooltips/)**

## Why another tooltip library?

- **Singleton architecture** — a single tooltip element is re-pointed between anchors instead of
  being destroyed and recreated. Sweep across a dense grid and the tooltip *glides*; the enter
  animation never restarts mid-sweep (the classic `MatTooltip` flicker).
- **Top layer, always** — the tooltip is a native `[popover]`, so it renders above dialogs and is
  never clipped by `overflow` or `z-index` stacking contexts.
- **The browser does the work** — triggering (hover/focus/long-press/delays via
  `interestfor`), placement, auto-flipping at the viewport edge, tail direction, and
  hide-when-scrolled-out (`position-visibility: anchors-visible`).
- **Real component lifecycles** — template content is stamped per show and destroyed on
  hide/handoff: `ngOnInit`/`ngOnDestroy` run, `resource()` loads lazily, nothing leaks.
- **Fail fast** — missing platform support or an invalid host throws at construction
  instead of degrading silently.

## Installation

```bash
npm install @h-k-dev/angular-tooltips
```

Then import the **global stylesheet** once (it styles the singleton popover; nothing is
injected at runtime). In `angular.json`:

```json
"styles": [
  "node_modules/@h-k-dev/angular-tooltips/styles/angular-tooltips.css",
  "src/styles.scss"
]
```

or in your global `styles.css`:

```css
@import '@h-k-dev/angular-tooltips/styles/angular-tooltips.css';
```

## Usage

Attach the standalone directive to any element that can be an **interest invoker** —
`<button>`, `<a href>` or `<area href>`:

```ts
import { Component } from '@angular/core';
import { HkTooltip } from '@h-k-dev/angular-tooltips';

@Component({
  selector: 'app-demo',
  imports: [HkTooltip],
  template: `
    <button [hkTooltip]="'Save your progress'">Save</button>

    <button hkTooltip="Deletes immediately" hkTooltipPlacement="right" [hkTooltipDelay]="300">
      Delete
    </button>

    <a href="/docs" hkTooltip="Opens the documentation">Docs</a>
  `,
})
export class Demo {}
```

The `TooltipsManager` service exclusively manages the popover element and its content;
the directive is a thin trigger registration that wires `interestfor` and delays onto its
host. When interest moves to another trigger, the manager re-points the single
`--hk-invoker` anchor name — CSS re-resolves everything else automatically, even while the
popover is open.

## API

### `[hkTooltip]` directive

**Throws at construction** when CSS Anchor Positioning or Interest Invokers are
unsupported, or when the host element cannot be an interest invoker (anything other than
`<button>`, `<a href>`, `<area href>`).

| Input                | Type                                                | Default     | Description                                                 |
| -------------------- | --------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `hkTooltip`          | `string \| TemplateRef<HkTooltipContext>` (required) | —           | Tooltip text, or a template for rich content (see below).   |
| `hkTooltipData`      | `unknown`                                            | `undefined` | Context for template content — the template's implicit `let` variable. |
| `hkTooltipPlacement` | `'top' \| 'bottom' \| 'left' \| 'right'`             | `'top'`     | Preferred side; auto-flips when space runs out.             |
| `hkTooltipDelay`     | `number` (ms)                                        | `0`         | Show delay — maps to CSS `interest-delay-start`.            |
| `hkTooltipHideDelay` | `number` (ms)                                        | `80`        | Hide delay — maps to CSS `interest-delay-end`.              |

### `supportsAnchorPositioning()` / `supportsInterestInvokers()`

The platform checks the directive requires — use them to gate rendering in apps that must
also run on non-Chromium browsers.

## Rich content — templates, lazy loading & caching

Pass an `<ng-template>` instead of a string. The template is stamped into the singleton
**lazily on first show** and destroyed on hide/swap — nothing is instantiated for tooltips
that are never shown:

```html
<button [hkTooltip]="userCard" [hkTooltipData]="user.id">&#64;{{ user.handle }}</button>

<ng-template #userCard let-userId>
  <app-user-hover-card [userId]="userId" />
</ng-template>
```

Because the projected component is only created when the tooltip opens, a `resource()`
inside it is lazy by construction — the loader fires on first show, never eagerly:

```ts
@Component({ selector: 'app-user-hover-card' /* … */ })
export class UserHoverCard {
  readonly userId = input.required<string>();
  readonly #cache = inject(HkTooltipCache);

  readonly user = resource({
    params: () => this.userId(),
    loader: ({ params }) =>
      this.#cache.getOrFetch(`user:${params}`, () =>
        fetch(`/api/users/${params}`).then((r) => r.json()),
      ),
  });
}
```

Notes:

- String content keeps `role="tooltip"`. Template content drops the role (it is a
  hovercard, not a tooltip, in ARIA terms) and may contain interactive elements —
  interest is sustained while hovering the tooltip itself, so rich content stays
  interactable for free.
- Projected components run their **full lifecycle**: `ngOnInit` on stamp, `ngOnDestroy`
  on hide or when interest moves to another trigger — see the "Anchor Tooltips" page in
  the demo for a live lifecycle log.

### `HkTooltipCache`

App-level TTL + LRU cache for async tooltip content. The **promise** is cached, so
concurrent hovers on the same key share one request; rejected promises are evicted
immediately, so errors are never cached.

```ts
bootstrapApplication(App, {
  providers: [provideHkTooltipCache({ ttl: 60_000, maxEntries: 200 })],
});
```

| Member                                | Description                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| `getOrFetch(key, fetcher, ttl?)`       | Return the cached promise for `key`, or run `fetcher` and cache it. |
| `invalidate(key)`                      | Drop one entry, e.g. after a mutation.                              |
| `invalidatePrefix(prefix)`             | Drop every entry whose key starts with `prefix`, e.g. `"user:"`.    |
| `clear()`                              | Drop everything.                                                    |

Cache **lifetime is scoped by DI**, not manual bookkeeping: the root-provided default lives
for the app (bounded by TTL). To tie a cache to a page or feature, add `HkTooltipCache` to
that component's `providers` — Angular destroys the service with the component and the
cache is cleared with it. Embedded views and in-flight requests are already cleaned up
automatically when a trigger or its projected component is destroyed.

## How triggering works

Every trigger's host carries `interestfor` pointing at the one singleton popover; the
browser owns hover, keyboard focus, touch long-press and the delays (mapped to CSS
`interest-delay-start` / `interest-delay-end` from the same inputs). The library's only
runtime hooks are events the browser fires **on the popover**:

- `interest` (before opening, `source` = the invoker): render the content and move the
  `--hk-invoker` anchor name onto the source. If the trigger has no content yet, the event
  is cancelled so the browser never opens an empty bubble.
- `loseinterest`: hide and destroy any stamped view.

The singleton popover is **re-pointed** between anchors, never destroyed and recreated —
sweeping across a dense grid never restarts the enter animation.

### Handoffs (why this is subtle)

The browser reports interest loss only after `interest-delay-end` has elapsed, so during a
fast trigger → trigger sweep a **stale** `loseinterest` (belonging to the invoker you
already left) arrives while the next trigger's tooltip is showing. The manager applies two
rules:

1. **`loseinterest` is never cancelled.** Cancelling it leaves the invoker permanently
   "interested": its next hover fires no `interest` event, and that trigger's tooltip
   silently stops working. The browser is always allowed to clear its interest state and
   run its default hide.
2. **The popover is restored before the next paint** — but only if the active trigger is
   still engaged (host `:hover`, `:focus-within`, or the tooltip itself hovered). The
   reopen suppresses the entrance animation, so visually the tooltip never left. If
   nothing is engaged, the hide stands: a trigger → trigger → empty-space sweep cannot
   resurrect a tooltip into empty space.

The guarantees that fall out: hover across triggers in any order, revisit as often as you
like — no flicker on handoff, no lost interest state, no stuck tooltips.

## Theming

The tooltip is styled through CSS custom properties with the **`--tt-` prefix**. Every variable
falls back to the **Angular Material tooltip tokens**, then the **`--mat-sys-*` system tokens**,
then a built-in default:

```text
--tt-*  (your theme)  →  --mat-tooltip-*  →  --mat-sys-*  →  default
```

With an Angular Material theme present, the tooltip matches it out of the box. Without Material,
the defaults give you the familiar dark M3 look. Override on `:root` (or any ancestor of `<body>`):

```css
:root {
  --tt-container-color: #1e293b;
  --tt-text-color: #e2e8f0;
  --tt-border-radius: 8px;
  --tt-max-width: 320px;
}
```

| Variable              | Purpose                       | Material fallback                                                       | Default             |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------- | ------------------- |
| `--tt-container-color`| Background of bubble and tail | `--mat-tooltip-container-color` → `--mat-sys-inverse-surface`            | `#313033`           |
| `--tt-text-color`     | Text color                    | `--mat-tooltip-supporting-text-color` → `--mat-sys-inverse-on-surface`   | `#f4eff4`           |
| `--tt-border-radius`  | Corner radius                 | `--mat-tooltip-container-shape` → `--mat-sys-corner-extra-small`         | `4px`               |
| `--tt-font-family`    | Font family                   | `--mat-tooltip-supporting-text-font` → `--mat-sys-body-small-font`       | `Roboto, sans-serif`|
| `--tt-font-size`      | Font size                     | `--mat-tooltip-supporting-text-size` → `--mat-sys-body-small-size`       | `12px`              |
| `--tt-font-weight`    | Font weight                   | `--mat-tooltip-supporting-text-weight` → `--mat-sys-body-small-weight`   | `400`               |
| `--tt-line-height`    | Line height                   | `--mat-tooltip-supporting-text-line-height` → `--mat-sys-body-small-line-height` | `1.4`       |
| `--tt-letter-spacing` | Letter spacing                | `--mat-tooltip-supporting-text-tracking` → `--mat-sys-body-small-tracking` | `0.033em`         |
| `--tt-shadow`         | Box shadow                    | —                                                                        | `none`              |
| `--tt-padding`        | Inner padding                 | —                                                                        | `6px 10px`          |
| `--tt-max-width`      | Maximum width                 | —                                                                        | `280px`             |
| `--tt-gap`            | Distance from the anchor      | —                                                                        | `8px`               |
| `--tt-tail-size`      | Tail (arrow) size             | —                                                                        | `6px`               |
| `--tt-enter-duration` | Slide-in duration             | —                                                                        | `0.3s`              |
| `--tt-fade-duration`  | Fade-in duration              | —                                                                        | `0.15s`             |
| `--tt-slide-distance` | Slide-in distance             | —                                                                        | `10px`              |

> Keep `--tt-tail-size` smaller than `--tt-gap`, so the tail never overlaps the trigger.

## Browser support

Requires **both** [CSS Anchor Positioning](https://caniuse.com/css-anchor-positioning)
and Interest Invokers (`interestfor`) — today that means Chrome and other Chromium-based
browsers. There is no silent fallback: the directive throws at construction on an
unsupported platform (and on a host element that cannot be an interest invoker). Gate
rendering with `supportsAnchorPositioning()` / `supportsInterestInvokers()` if your app
must also load elsewhere.

## Development

```bash
npm start                        # demo app on http://localhost:4200
npm run test:ci                  # headless vitest suite
npm run build angular-tooltips   # build the library into dist/
```

Releases are automated with semantic-release: conventional commits pushed to `main` (or `beta`
for prereleases) publish to npm and GitHub Packages and deploy the demo to GitHub Pages.

## License

[MIT](LICENSE)
