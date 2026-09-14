# @h-k-dev/angular-tooltips

[![npm version](https://img.shields.io/npm/v/@h-k-dev/angular-tooltips.svg)](https://www.npmjs.com/package/@h-k-dev/angular-tooltips)
[![CI/CD](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml/badge.svg)](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!WARNING]
> **Experimental — Chromium only.** This library is built on bleeding-edge platform features
> (CSS Anchor Positioning, `position-visibility`, anchored container queries, and
> [Interest Invokers](https://developer.chrome.com/blog/interestfor)) that are currently only
> supported in Chrome and other Chromium-based browsers. There is **no fallback** — the
> directives throw where the platform can't deliver. Expect breaking changes while the
> underlying specs and this API settle.

Modern, anchor-native tooltips for Angular. One singleton popover element, **two trigger
engines with one API**, zero JS positioning:

- **`hkTooltip` — the invoker engine.** On hosts that can be Interest Invokers (`<button>`,
  `<a href>`, `<area href>`) the browser owns hover, keyboard focus, touch long-press and the
  delays via `interestfor` — no event listeners, no timers.
- **`hkJsTooltip` — the JS engine.** On everything else (`<span>`, `<div>`, `<img>`,
  `<input>`, icons, component hosts) the directive does what the browser does for invokers,
  tippy-style: pointer/focus listeners, delays, keep-open while hovering the bubble, Escape
  and tap-outside to dismiss.
- **Positioning** is CSS Anchor Positioning for both: placement, viewport flipping, tail
  direction and scroll tracking are browser CSS — no rect reads, no scroll listeners.
- **They blend.** Both engines end in the same `show()` on the same singleton and move the
  same `anchor-name`, so a pointer sweeping from a button onto a span and back is one
  continuous tooltip — no close, no re-entrance animation.

**[Live demo →](https://h-k-dev.github.io/angular-tooltips/)**

## Why another tooltip library?

- **Singleton architecture** — a single tooltip element is re-pointed between anchors instead of
  being destroyed and recreated. Sweep across a dense grid and the tooltip *glides*; the enter
  animation never restarts mid-sweep (the classic `MatTooltip` flicker).
- **Top layer, always** — the tooltip is a native `[popover]`, so it renders above dialogs and is
  never clipped by `overflow` or `z-index` stacking contexts.
- **The browser does the work** — triggering (hover/focus/long-press/delays via
  `interestfor`) wherever it can, placement, auto-flipping at the viewport edge, tail
  direction, and hide-when-scrolled-out (`position-visibility: anchors-visible`).
- **Real component lifecycles** — template content is stamped per show and destroyed on
  hide/handoff: `ngOnInit`/`ngOnDestroy` run, `resource()` loads lazily, nothing leaks.
- **Fail fast** — missing platform support or the wrong directive for a host throws at
  construction instead of degrading silently.

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

Pick the directive by host: `hkTooltip` for elements that can be **interest invokers**
(`<button>`, `<a href>`, `<area href>`), `hkJsTooltip` for **everything else**. The
secondary inputs share the same names on both.

```ts
import { Component } from '@angular/core';
import { HkTooltip, HkJsTooltip } from '@h-k-dev/angular-tooltips';

@Component({
  selector: 'app-demo',
  imports: [HkTooltip, HkJsTooltip],
  template: `
    <!-- invoker engine: the browser triggers these -->
    <button [hkTooltip]="'Save your progress'">Save</button>

    <button hkTooltip="Deletes immediately" hkTooltipPlacement="right" hkTooltipShowDelay="300">
      Delete
    </button>

    <a href="/docs" hkTooltip="Opens the documentation">Docs</a>

    <!-- JS engine: the directive triggers these -->
    <span tabindex="0" hkJsTooltip="An inline span">status</span>
    <img src="avatar.png" alt="" hkJsTooltip="Amelia Chen" hkTooltipPlacement="bottom" />
    <input placeholder="Search" hkJsTooltip="Shows on focus too" />
  `,
})
export class Demo {}
```

Using the wrong directive for a host throws at construction: `hkTooltip` on a `<span>`, or
`hkJsTooltip` on a `<button>` (the browser engine is strictly better there).

The `TooltipsManager` service exclusively manages the popover element and its content; the
directives are thin trigger registrations. Whenever a trigger is shown, the manager re-points
the single `--hk-invoker` anchor name — CSS re-resolves everything else automatically, even
while the popover is open.

## API

Both directives implement the same interface, so consumers can hold either as an
`HkTooltipTrigger`:

```ts
export interface HkTooltipTrigger {
  readonly hostEl: HTMLElement;
  readonly engine: 'invoker' | 'js';

  readonly content: Signal<string | TemplateRef<HkTooltipContext>>;
  readonly data: Signal<unknown>;
  readonly placement: Signal<'top' | 'bottom' | 'left' | 'right'>;
  readonly showDelay: Signal<number>;
  readonly hideDelay: Signal<number>;
  readonly disabled: Signal<boolean>;

  show(delay?: number): void; // default: showDelay
  hide(delay?: number): void; // default: hideDelay
  toggle(): void;
  isVisible(): boolean;
}
```

### Inputs (identical on `[hkTooltip]` and `[hkJsTooltip]`)

| Input                                 | Type                                                 | Default     | Description                                                            |
| ------------------------------------- | ---------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `hkTooltip` **or** `hkJsTooltip`      | `string \| TemplateRef<HkTooltipContext>` (required) | —           | Tooltip text, or a template for rich content (see below).              |
| `hkTooltipData`                       | `unknown`                                            | `undefined` | Context for template content — the template's implicit `let` variable. |
| `hkTooltipPlacement`                  | `'top' \| 'bottom' \| 'left' \| 'right'`             | `'top'`     | Preferred side; auto-flips when space runs out.                        |
| `hkTooltipShowDelay`                  | `number` (ms)                                        | `0`         | Show delay. Invoker engine: CSS `interest-delay-start`.                |
| `hkTooltipHideDelay`                  | `number` (ms)                                        | `80`        | Hide delay. Invoker engine: CSS `interest-delay-end`.                  |
| `hkTooltipDisabled`                   | `boolean`                                            | `false`     | Never shows while `true` (hides if currently open).                    |

An **open** tooltip re-renders in place when `content`, `data`, `placement` or `disabled`
change.

### Methods (`exportAs: 'hkTooltip'` / `'hkJsTooltip'`)

```html
<button #tip="hkTooltip" hkTooltip="Copied!">Copy</button>
<button (click)="tip.show(0)">show</button>
<button (click)="tip.hide()">hide</button>
<button (click)="tip.toggle()">toggle</button>
```

Programmatic `show()` opens the popover manually on either engine; it stays until `hide()`,
the trigger's own hide path, or (JS engine) Escape / a pointerdown outside.

### Engines

| Engine    | Directive     | Hosts                                        | Hover / focus / touch                                     |
| --------- | ------------- | -------------------------------------------- | --------------------------------------------------------- |
| `invoker` | `hkTooltip`   | `<button>`, `<a href>`, `<area href>`        | Browser-native via `interestfor` (long-press on touch).   |
| `js`      | `hkJsTooltip` | any other element or component host          | Pointer enter/leave, `:focus-visible` focus, tap to show. |

Both: keep-open while hovering the bubble, same delays, same singleton, same CSS.

### `supportsAnchorPositioning()` / `supportsInterestInvokers()` / `isInterestInvoker(el)`

The platform checks the directives require, and the host check that splits the engines — use
them to gate rendering in apps that must also run on non-Chromium browsers.

## Rich content — templates, lazy loading & caching

Pass an `<ng-template>` instead of a string, on either engine. The template is stamped into
the singleton **lazily on first show** and destroyed on hide/swap — nothing is instantiated
for tooltips that are never shown:

```html
<button [hkTooltip]="userCard" [hkTooltipData]="user.id">&#64;{{ user.handle }}</button>
<span tabindex="0" [hkJsTooltip]="userCard" [hkTooltipData]="user.id">&#64;{{ user.handle }}</span>

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
  the tooltip stays open while hovered on both engines, so rich content stays
  interactable for free.
- Projected components run their **full lifecycle**: `ngOnInit` on stamp, `ngOnDestroy`
  on hide or when the singleton moves to another trigger — see the "Invoker" and
  "JS Anchor" pages in the demo for a live lifecycle log.

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

### Invoker engine

Every `hkTooltip` host carries `interestfor` pointing at the one singleton popover; the
browser owns hover, keyboard focus, touch long-press and the delays (mapped to CSS
`interest-delay-start` / `interest-delay-end` from the same inputs). The library's only
runtime hooks are events the browser fires **on the popover**:

- `interest` (before opening, `source` = the invoker): render the content and move the
  `--hk-invoker` anchor name onto the source. If the trigger is disabled or has no content
  yet, the event is cancelled so the browser never opens an empty bubble.
- `loseinterest`: hide, destroy any stamped view and release the anchor name.

### JS engine

Every `hkJsTooltip` host listens to `pointerenter` / `pointerleave` (mouse and pen; a touch
tap shows immediately) and `focusin` / `focusout` (`:focus-visible` only, so a mouse click
that focuses the host does not pop the tooltip). Delays run on timers; the manager keeps a
JS tooltip open while the popover itself is hovered and closes it on Escape or a
`pointerdown` outside the trigger and the popover.

### Handoffs (why this is subtle)

The singleton popover is **re-pointed** between triggers, never destroyed and recreated —
sweeping across a dense grid never restarts the enter animation, whichever engine each cell
uses. Two rules make that hold across engines:

1. **`loseinterest` is never cancelled.** Cancelling it leaves the invoker permanently
   "interested": its next hover fires no `interest` event, and that trigger's tooltip
   silently stops working. The browser is always allowed to clear its interest state and
   run its default hide.
2. **The popover is restored before the next paint** — but only if the active trigger is
   still engaged (host `:hover`, `:focus-within`, or the tooltip itself hovered). This is
   what makes an invoker → JS handoff seamless: the invoker's `interest-delay-end` fires
   after the pointer already reached the JS trigger, the browser closes the popover, and the
   manager reopens it in the same task with the entrance animation suppressed. If nothing is
   engaged, the hide stands: a trigger → trigger → empty-space sweep cannot resurrect a
   tooltip into empty space.

The anchor name is **released on every hide**. Two hosts carrying the same `anchor-name`
resolve to the last one in tree order, so a stale name would put the bubble next to the
wrong element.

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

Requires [CSS Anchor Positioning](https://caniuse.com/css-anchor-positioning) (both engines)
and Interest Invokers (`interestfor`, the `hkTooltip` engine) — today that means Chrome and
other Chromium-based browsers. There is no silent fallback: the directives throw at
construction on an unsupported platform, and when used on the wrong kind of host. Gate
rendering with `supportsAnchorPositioning()` / `supportsInterestInvokers()` if your app must
also load elsewhere.

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
