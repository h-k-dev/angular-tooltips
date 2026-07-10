import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { TooltipsManager, TOOLTIP_ID } from './angular-tooltips';
import { JSTooltips } from './js-tooltips';

@Component({
  imports: [JSTooltips],
  template: `<button hkJsTooltip="Hi from JS" hkJsTooltipPlacement="bottom">Hover me</button>`,
})
class Host {}

@Component({
  imports: [JSTooltips],
  template: `
    <span [hkJsTooltip]="card" [hkJsTooltipData]="7">u7</span>
    <ng-template #card let-id>
      <b class="js-card">User {{ id }}</b>
    </ng-template>
  `,
})
class TemplateHost {}

// The JS directive is for environments WITHOUT CSS Anchor Positioning, so
// the stubbed support check defaults to false here (the jsdom reality).
let anchorSupported = false;
const realCSS = globalThis.CSS;
const realMatches = Element.prototype.matches;
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => anchorSupported };
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':popover-open' || selector === ':hover' || selector === ':focus-within') {
      return false;
    }
    return realMatches.call(this, selector);
  } as typeof Element.prototype.matches;
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
  Element.prototype.matches = realMatches;
});

beforeEach(() => {
  anchorSupported = false;
});
afterEach(() => {
  document.getElementById(TOOLTIP_ID)?.remove();
});

function tooltipEl(): HTMLElement {
  return document.getElementById(TOOLTIP_ID)!;
}

describe('JSTooltips', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const directive = fixture.debugElement.query(By.directive(JSTooltips));
    expect(directive).toBeTruthy();
    expect(directive.injector.get(JSTooltips).content()).toBe('Hi from JS');
  });

  it('throws at construction where CSS Anchor Positioning IS supported', () => {
    anchorSupported = true;
    expect(() => {
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
    }).toThrowError(/hkTooltip/);
  });

  it('positions with the JS engine: class, resolved data-placement and px coordinates', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const dir = fixture.debugElement.query(By.directive(JSTooltips)).injector.get(JSTooltips);

    TestBed.inject(TooltipsManager).show(dir);

    const el = tooltipEl();
    expect(el.textContent).toBe('Hi from JS');
    expect(el.getAttribute('role')).toBe('tooltip');
    expect(el.classList.contains('hk-tooltip--js')).toBe(true);
    expect(el.classList.contains('hk-tooltip--anchor')).toBe(false);
    expect(el.getAttribute('data-placement')).toBe('bottom');
    expect(el.style.left).toMatch(/px$/);
    expect(el.style.top).toMatch(/px$/);
    // the anchor engine's machinery must not leak in
    expect(el.style.getPropertyValue('position-anchor')).toBe('');
    expect(el.hasAttribute('data-placement-pref')).toBe(false);
  });

  it('flips to the opposite side when the preferred side has no room', async () => {
    @Component({
      imports: [JSTooltips],
      template: `<button hkJsTooltip="flip me" hkJsTooltipPlacement="top">Hover me</button>`,
    })
    class TopHost {}
    const fixture = TestBed.createComponent(TopHost);
    await fixture.whenStable();
    const dir = fixture.debugElement.query(By.directive(JSTooltips)).injector.get(JSTooltips);

    TestBed.inject(TooltipsManager).show(dir);

    // jsdom rects are all zero: no room above (anchor.top = 0), plenty
    // below — the tippy-style flip resolves top → bottom.
    expect(tooltipEl().getAttribute('data-placement')).toBe('bottom');
  });

  it('stamps template content via body delegation', async () => {
    const fixture = TestBed.createComponent(TemplateHost);
    await fixture.whenStable();

    const target = (fixture.nativeElement as Element).querySelector('span')!;
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(tooltipEl().querySelector('.js-card')?.textContent).toContain('User 7');
    expect(tooltipEl().hasAttribute('role')).toBe(false);
  });
});
