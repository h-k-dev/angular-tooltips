# @h-k-dev/angular-tooltips

[![npm version](https://img.shields.io/npm/v/@h-k-dev/angular-tooltips.svg)](https://www.npmjs.com/package/@h-k-dev/angular-tooltips)
[![CI/CD](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml/badge.svg)](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!WARNING]
> **Experimental.** The `[hkTooltip]` directive is built on bleeding-edge platform features
> (CSS Anchor Positioning, `position-visibility`, anchored container queries, and Interest
> Invokers) that are currently only fully supported in Chrome and other Chromium-based
> browsers. For everything else there is the JS-positioned `[hkJsTooltip]` directive. Expect
> breaking changes while the underlying specs and this API settle.

Modern, lightweight tooltips for Angular. One singleton popover element and **two strictly
separated positioning engines**, one directive each:

- **`[hkTooltip]`** — the complete CSS Anchor Positioning way: placement, viewport flipping,
  tail direction and scroll tracking are all browser CSS. No overlay module, no scroll
  listeners, no per-trigger DOM.
- **`[hkJsTooltip]`** — what tippy does, the Angular way: `getBoundingClientRect` math,
  flip + clamp, scroll/resize tracking while open. For browsers without anchor positioning.

Using the wrong directive for the platform **throws at construction** — early and loud
instead of a silent degraded experience. Branch templates with the exported
`supportsAnchorPositioning()` helper.

**[Live demo →](https://h-k-dev.github.io/angular-tooltips/)**

## Why another tooltip library?

- **Singleton architecture** — a single tooltip element is re-pointed between anchors instead of
  being destroyed and recreated. Sweep across a dense grid and the tooltip *glides*; the enter
  animation never restarts mid-sweep (the classic `MatTooltip` flicker).
- **Top layer, always** — the tooltip is a native `[popover]`, so it renders above dialogs and is
  never clipped by `overflow` or `z-index` stacking contexts.
- **CSS does the work** — placement, auto-flipping at the viewport edge, tail direction, and
  hide-when-scrolled-out (`position-visibility: anchors-visible`) are all handled by the browser.
- **Browser-native triggering for links** — on `<a href>` elements in supporting browsers, the
  [Interest Invokers](https://developer.chrome.com/blog/interestfor) (`interestfor`) path is used:
  the browser owns hover, keyboard focus, touch long-press, and delays.
- **Works on any element** — `<button>`, `<a>`, `<span>`, `<div>`, `<img>`, `<input>`, icons,
  component hosts…
- **Fail fast** — the wrong directive for the platform throws at construction instead of
  degrading silently.

## Installation

```bash
npm install @h-k-dev/angular-tooltips
```

Then import the **global stylesheet** once (it styles the singleton popover for both
engines; nothing is injected at runtime). In `angular.json`:

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

Import the standalone directive for your platform and attach it to anything:

```ts
import { Component } from '@angular/core';
import { HkTooltip, JSTooltips, supportsAnchorPositioning } from '@h-k-dev/angular-tooltips';

@Component({
  selector: 'app-demo',
  imports: [HkTooltip, JSTooltips],
  template: `
    @if (anchorSupported) {
      <button [hkTooltip]="'Save your progress'">Save</button>
      <button hkTooltip="Deletes immediately" hkTooltipPlacement="right" [hkTooltipDelay]="300">
        Delete
      </button>
      <a href="/docs" hkTooltip="Opens the documentation">Docs</a>
    } @else {
      <button [hkJsTooltip]="'Save your progress'">Save</button>
      <button hkJsTooltip="Deletes immediately" hkJsTooltipPlacement="right" [hkJsTooltipDelay]="300">
        Delete
      </button>
      <a href="/docs" hkJsTooltip="Opens the documentation">Docs</a>
    }
  `,
})
export class Demo {
  protected readonly anchorSupported = supportsAnchorPositioning();
}
```

Both engines share one singleton popover, one content model (strings or templates), one
delegation system and one cache — the `TooltipsManager` service exclusively manages the
popover element and its content; the directives are thin trigger registrations.

## API

### `[hkTooltip]` directive — CSS Anchor Positioning engine

**Throws at construction** when CSS Anchor Positioning is unsupported — use `[hkJsTooltip]`
there instead.

| Input                | Type                                                | Default     | Description                                                 |
| -------------------- | --------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `hkTooltip`          | `string \| TemplateRef<HkTooltipContext>` (required) | —           | Tooltip text, or a template for rich content (see below).   |
| `hkTooltipData`      | `unknown`                                            | `undefined` | Context for template content — the template's implicit `let` variable. |
| `hkTooltipPlacement` | `'top' \| 'bottom' \| 'left' \| 'right'`             | `'top'`     | Preferred side; auto-flips when space runs out.             |
| `hkTooltipDelay`     | `number` (ms)                                        | `0`         | Delay before showing.                                       |
| `hkTooltipHideDelay` | `number` (ms)                                        | `80`        | Delay before hiding.                                        |

### `[hkJsTooltip]` directive — JS engine (tippy-style)

**Throws at construction** where CSS Anchor Positioning IS supported — the CSS engine is
strictly better there (no rect reads, no scroll listeners, browser-owned flipping).

Identical semantics, `hkJsTooltip*`-prefixed inputs:

| Input                  | Type                                                | Default     |
| ---------------------- | --------------------------------------------------- | ----------- |
| `hkJsTooltip`          | `string \| TemplateRef<HkTooltipContext>` (required) | —           |
| `hkJsTooltipData`      | `unknown`                                            | `undefined` |
| `hkJsTooltipPlacement` | `'top' \| 'bottom' \| 'left' \| 'right'`             | `'top'`     |
| `hkJsTooltipDelay`     | `number` (ms)                                        | `0`         |
| `hkJsTooltipHideDelay` | `number` (ms)                                        | `80`        |

### `supportsAnchorPositioning()`

The feature check the two directives split on — use it to branch your templates.

### `[hkTooltipRoot]` directive

Optional. Scopes the event delegation to a subtree (for example a virtualized grid) instead of
`document.body`.

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
  hovering the tooltip keeps it open on both trigger paths.
- Everything on this page works identically with `[hkJsTooltip]` (`hkJsTooltipData`, same
  template context) — the content model lives in the shared manager, not the directives.

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

## Trigger paths & handoffs

Per host element, the trigger mechanism is:

| Host                                                 | Path          | Who owns show/hide                                                                                                        |
| ---------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `[hkTooltip]` on `<a href>` with Interest Invokers   | `interestfor` | The **browser**: hover, keyboard focus, touch long-press; delays map to CSS `interest-delay-start` / `interest-delay-end`. |
| every other trigger (either directive)               | JS delegation | The **library**: delegated `mouseover`/`focusin` listeners plus show/hide timers.                                          |

Positioning is a separate axis: `[hkTooltip]` positions via CSS anchor properties
(`.hk-tooltip--anchor` rules), `[hkJsTooltip]` via manager-computed coordinates
(`.hk-tooltip--js` rules) — each trigger toggles its engine class on the singleton, so
only its stylesheet rules apply.

Both paths carry a single `data-tooltip-id` attribute on the host and resolve the
directive from a registry, reading content, placement and delays live off its signals.
The singleton popover is **re-pointed** between anchors, never destroyed and recreated —
sweeping across a dense grid never restarts the enter animation.

### Mixed-path handoffs (why this is subtle)

Moving the pointer between an `interestfor` link and a JS-path trigger crosses two
independent state machines — and the browser reports interest loss only after
`interest-delay-end` has elapsed. So during a fast link → tile sweep, a **stale**
`loseinterest` (belonging to the link you already left) arrives while the tile's tooltip
is showing. The manager applies two rules:

1. **`loseinterest` is never cancelled.** Cancelling it leaves the invoker permanently
   "interested": its next hover fires no `interest` event, and that trigger's tooltip
   silently stops working. The browser is always allowed to clear its interest state and
   run its default hide.
2. **The popover is restored before the next paint** — but only if the active trigger is
   still engaged (host `:hover`, `:focus-within`, or the tooltip itself hovered). The
   reopen suppresses the entrance animation, so visually the tooltip never left. If
   nothing is engaged, the hide stands: a link → tile → empty-space sweep cannot
   resurrect a tooltip into empty space.

The guarantees that fall out: hover across links and non-links in any order, revisit
triggers as often as you like — no flicker on handoff, no lost interest state, no stuck
tooltips.

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

| Capability                                   | Directive to use                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| [CSS Anchor Positioning](https://caniuse.com/css-anchor-positioning) | `[hkTooltip]` — full CSS engine: auto-flip, tail queries, scroll tracking.     |
| Additionally Interest Invokers (`interestfor`) | `[hkTooltip]` — plus browser-native triggering on `<a href>` links.           |
| No CSS Anchor Positioning                    | `[hkJsTooltip]` — JS engine (tippy-style math, scroll/resize tracking).        |

There is no silent fallback: each directive throws at construction on the wrong platform.
Branch with `supportsAnchorPositioning()`.

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
