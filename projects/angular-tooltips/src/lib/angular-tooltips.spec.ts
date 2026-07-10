import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HkTooltip, TooltipsManager, TOOLTIP_ID } from './angular-tooltips';

@Component({
  imports: [HkTooltip],
  template: `<button hkTooltip="Hello">Hover me</button>`,
})
class Host {}

@Component({
  imports: [HkTooltip],
  template: `
    <button [hkTooltip]="card" [hkTooltipData]="42">Hover me</button>
    <ng-template #card let-id>
      <span class="user-card">User {{ id }}</span>
    </ng-template>
  `,
})
class TemplateHost {}

@Component({
  imports: [HkTooltip],
  template: `
    <a href="/docs" [hkTooltip]="card" [hkTooltipData]="'anchor'">link</a>
    <span [hkTooltip]="card" [hkTooltipData]="'span'">span</span>
    <div [hkTooltip]="card" [hkTooltipData]="'div'"><em>nested child</em></div>
    <ng-template #card let-tag>
      <b class="tag-card">from {{ tag }}</b>
    </ng-template>
  `,
})
class MultiTagHost {}

// The test DOM knows neither CSS Anchor Positioning, the Popover API, nor
// the :popover-open pseudo-class. `anchorSupported` steers the lazy
// supportsAnchorPositioning() check (hkTooltip throws when it is false);
// :hover / :focus-within report engagement from the fakeHover set so tests
// can steer the manager's handoff logic.
let anchorSupported = true;
const fakeHover = new Set<Element>();
const realCSS = globalThis.CSS;
const realMatches = Element.prototype.matches;
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => anchorSupported };
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':popover-open') return false;
    if (selector === ':hover' || selector === ':focus-within') return fakeHover.has(this);
    return realMatches.call(this, selector);
  } as typeof Element.prototype.matches;
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
  Element.prototype.matches = realMatches;
});

beforeEach(() => {
  anchorSupported = true;
});
afterEach(() => {
  fakeHover.clear();
  // Each test gets a fresh manager; drop the singleton it appended to <body>.
  document.getElementById(TOOLTIP_ID)?.remove();
});

function tooltipEl(): HTMLElement {
  return document.getElementById(TOOLTIP_ID)!;
}

describe('HkTooltip', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const directive = fixture.debugElement.query(By.directive(HkTooltip));
    expect(directive).toBeTruthy();
    expect(directive.injector.get(HkTooltip).content()).toBe('Hello');
  });

  it('throws at construction without CSS Anchor Positioning support', () => {
    anchorSupported = false;
    expect(() => {
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
    }).toThrowError(/hkJsTooltip/);
  });

  it('renders string content with role="tooltip" and the anchor engine class', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const dir = fixture.debugElement.query(By.directive(HkTooltip)).injector.get(HkTooltip);

    TestBed.inject(TooltipsManager).show(dir);

    expect(tooltipEl().textContent).toBe('Hello');
    expect(tooltipEl().getAttribute('role')).toBe('tooltip');
    expect(tooltipEl().classList.contains('hk-tooltip--anchor')).toBe(true);
    expect(tooltipEl().classList.contains('hk-tooltip--js')).toBe(false);
    expect(tooltipEl().getAttribute('data-placement-pref')).toBe('top');
  });

  it('stamps template content lazily with [hkTooltipData] as $implicit', async () => {
    const fixture = TestBed.createComponent(TemplateHost);
    await fixture.whenStable();
    const dir = fixture.debugElement.query(By.directive(HkTooltip)).injector.get(HkTooltip);
    const manager = TestBed.inject(TooltipsManager);

    // Nothing is instantiated before the first show.
    expect(tooltipEl().querySelector('.user-card')).toBeNull();

    manager.show(dir);

    expect(tooltipEl().querySelector('.user-card')?.textContent).toContain('User 42');
    // Rich content is a hovercard, not a tooltip, in ARIA terms.
    expect(tooltipEl().hasAttribute('role')).toBe(false);
  });

  it('shows template content via body delegation from any host tag', async () => {
    const fixture = TestBed.createComponent(MultiTagHost);
    await fixture.whenStable();

    const cases: [string, string][] = [
      ['a', 'from anchor'], // no Interest Invokers in jsdom → JS-delegation path
      ['span', 'from span'],
      ['div em', 'from div'], // bubbles from a nested child → closest() lookup
    ];
    for (const [selector, expected] of cases) {
      const target = (fixture.nativeElement as Element).querySelector(selector)!;
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(tooltipEl().querySelector('.tag-card')?.textContent).toBe(expected);
    }
  });

  it('hands off from an interestfor anchor without breaking either tooltip', async () => {
    const fixture = TestBed.createComponent(MultiTagHost);
    await fixture.whenStable();
    const manager = TestBed.inject(TooltipsManager);
    const [linkDe, spanDe] = fixture.debugElement.queryAll(By.directive(HkTooltip));
    const link = linkDe.injector.get(HkTooltip);
    const span = spanDe.injector.get(HkTooltip);

    const loseInterest = () => {
      const e = new Event('loseinterest', { cancelable: true });
      Object.defineProperty(e, 'source', { value: linkDe.nativeElement });
      tooltipEl().dispatchEvent(e);
      return e;
    };
    // What the browser does whenever it executes the popover hide (sync or
    // in a later task — implementations differ): beforetoggle fires inside.
    const browserHide = () => {
      const e = new Event('beforetoggle');
      Object.defineProperty(e, 'newState', { value: 'closed' });
      tooltipEl().dispatchEvent(e);
    };
    const flushMicrotasks = () => Promise.resolve();

    // Pointer moved link → span before interest-delay-end elapsed. The
    // stale loseinterest must NOT be cancelled — a cancelled loseinterest
    // leaves the invoker permanently "interested" and its next hover fires
    // no interest event at all. The handler leaves the hiding to the
    // browser.
    manager.show(link);
    manager.show(span);
    fakeHover.add(spanDe.nativeElement);
    const stale = loseInterest();
    expect(stale.defaultPrevented).toBe(false);
    expect(tooltipEl().querySelector('.tag-card')?.textContent).toBe('from span');

    // …and whenever the browser's hide actually executes, the beforetoggle
    // guard reopens before the next paint, entrance animation suppressed.
    browserHide();
    await flushMicrotasks();
    expect(tooltipEl().style.animation).toBe('none');
    expect(tooltipEl().querySelector('.tag-card')?.textContent).toBe('from span');

    // Same stale event with nothing engaged: hide for real — a
    // link → span → elsewhere sweep must not resurrect a tooltip.
    fakeHover.clear();
    tooltipEl().style.removeProperty('animation');
    const late = loseInterest();
    expect(late.defaultPrevented).toBe(false);
    await flushMicrotasks();
    expect(tooltipEl().textContent).toBe('');
    // a hide arriving with no active trigger must not reopen either
    browserHide();
    await flushMicrotasks();
    expect(tooltipEl().style.animation).toBe('');

    // And a loseinterest for the anchor that is actually active hides,
    // engaged or not.
    manager.show(link);
    fakeHover.add(linkDe.nativeElement);
    loseInterest();
    expect(tooltipEl().textContent).toBe('');
  });

  it('destroys the projected view when the trigger is destroyed', async () => {
    const fixture = TestBed.createComponent(TemplateHost);
    await fixture.whenStable();
    const dir = fixture.debugElement.query(By.directive(HkTooltip)).injector.get(HkTooltip);

    TestBed.inject(TooltipsManager).show(dir);
    expect(tooltipEl().querySelector('.user-card')).toBeTruthy();

    fixture.destroy();

    expect(tooltipEl().querySelector('.user-card')).toBeNull();
    expect(tooltipEl().textContent).toBe('');
  });
});
