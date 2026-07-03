# @h-k-dev/angular-tooltips

[![npm version](https://img.shields.io/npm/v/@h-k-dev/angular-tooltips.svg)](https://www.npmjs.com/package/@h-k-dev/angular-tooltips)
[![CI/CD](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml/badge.svg)](https://github.com/h-k-dev/angular-tooltips/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Modern, lightweight tooltips for Angular. One singleton popover element, positioned entirely by
**CSS Anchor Positioning** — no overlay module, no scroll listeners, no per-trigger DOM.

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
- **Graceful degradation** — browsers without CSS Anchor Positioning fall back to the native
  `title` attribute.

## Installation

```bash
npm install @h-k-dev/angular-tooltips
```

## Usage

Import the standalone directive and attach it to anything:

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

## API

### `[hkTooltip]` directive

| Input                | Type                                     | Default | Description                                     |
| -------------------- | ---------------------------------------- | ------- | ----------------------------------------------- |
| `hkTooltip`          | `string` (required)                      | —       | Tooltip text.                                   |
| `hkTooltipPlacement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Preferred side; auto-flips when space runs out. |
| `hkTooltipDelay`     | `number` (ms)                            | `0`     | Delay before showing.                           |
| `hkTooltipHideDelay` | `number` (ms)                            | `80`    | Delay before hiding.                            |

### `[hkTooltipRoot]` directive

Optional. Scopes the event delegation to a subtree (for example a virtualized grid) instead of
`document.body`.

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

| Capability                                   | Behaviour                                                       |
| -------------------------------------------- | --------------------------------------------------------------- |
| [CSS Anchor Positioning](https://caniuse.com/css-anchor-positioning) | Full experience: singleton popover, auto-flip, scroll tracking. |
| Interest Invokers (`interestfor`)            | Additionally: browser-native triggering on `<a href>` links.    |
| Neither                                      | Falls back to the native `title` attribute.                     |

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
