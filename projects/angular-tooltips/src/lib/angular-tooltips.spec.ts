import { Component, OnDestroy, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HkTooltip, TooltipsManager, TOOLTIP_ID } from './angular-tooltips';

// Lifecycle probe: proves projected components run ngOnInit/ngOnDestroy as
// the singleton switches between triggers.
const lifecycle = { inits: 0, destroys: 0 };

@Component({
  selector: 'spec-probe',
  template: `<span class="probe">probe</span>`,
})
class Probe implements OnInit, OnDestroy {
  ngOnInit() {
    lifecycle.inits++;
  }
  ngOnDestroy() {
    lifecycle.destroys++;
  }
}

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
  imports: [HkTooltip, Probe],
  template: `
    <button [hkTooltip]="cardA">A</button>
    <a href="/docs" [hkTooltip]="cardB">B</a>
    <ng-template #cardA><spec-probe /></ng-template>
    <ng-template #cardB><b class="b-card">B content</b></ng-template>
  `,
})
class TwoTriggerHost {}

// The test DOM knows neither CSS Anchor Positioning, Interest Invokers, the
// Popover API, nor the :popover-open pseudo-class. `anchorSupported` steers
// the lazy supportsAnchorPositioning() check; `interestForElement` is
// stubbed onto the REAL invoker prototypes only, so host-compatibility
// checks behave like the platform. :hover / :focus-within report engagement
// from the fakeHover set so tests can steer the handoff logic.
let anchorSupported = true;
const fakeHover = new Set<Element>();
const realCSS = globalThis.CSS;
const realMatches = Element.prototype.matches;
const INVOKER_PROTOS = [HTMLButtonElement.prototype, HTMLAnchorElement.prototype];
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => anchorSupported };
  for (const proto of INVOKER_PROTOS) {
    Object.defineProperty(proto, 'interestForElement', {
      value: null,
      writable: true,
      configurable: true,
    });
  }
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
  for (const proto of INVOKER_PROTOS) {
    delete (proto as { interestForElement?: unknown }).interestForElement;
  }
  Element.prototype.matches = realMatches;
});

beforeEach(() => {
  anchorSupported = true;
  lifecycle.inits = 0;
  lifecycle.destroys = 0;
});
afterEach(() => {
  fakeHover.clear();
  // Each test gets a fresh manager; drop the singleton it appended to <body>.
  document.getElementById(TOOLTIP_ID)?.remove();
});

function tooltipEl(): HTMLElement {
  return document.getElementById(TOOLTIP_ID)!;
}

/** What the browser fires on the target when an invoker gains interest. */
function gainInterest(source: Element): Event {
  const e = new Event('interest', { cancelable: true });
  Object.defineProperty(e, 'source', { value: source });
  tooltipEl().dispatchEvent(e);
  return e;
}

describe('HkTooltip', () => {
  it('should create and wire the interestfor trigger', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const de = fixture.debugElement.query(By.directive(HkTooltip));
    expect(de.injector.get(HkTooltip).content()).toBe('Hello');
    expect((de.nativeElement as Element).getAttribute('interestfor')).toBe(TOOLTIP_ID);
    expect((de.nativeElement as HTMLElement).style.getPropertyValue('interest-delay-end')).toBe(
      '80ms',
    );
  });

  it('throws at construction without platform support', () => {
    anchorSupported = false;
    expect(() => {
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
    }).toThrowError(/anchor-native/);
  });

  it('throws at construction on a host that cannot be an interest invoker', () => {
    @Component({
      imports: [HkTooltip],
      template: `<div hkTooltip="nope">div</div>`,
    })
    class DivHost {}
    expect(() => {
      const fixture = TestBed.createComponent(DivHost);
      fixture.detectChanges();
    }).toThrowError(/interest invoker/);
  });

  it('renders string content and moves the anchor name onto the source', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('button')!;

    const e = gainInterest(host);

    expect(e.defaultPrevented).toBe(false);
    expect(tooltipEl().textContent).toBe('Hello');
    expect(tooltipEl().getAttribute('role')).toBe('tooltip');
    expect(tooltipEl().getAttribute('data-placement-pref')).toBe('top');
    expect((host as HTMLElement).style.getPropertyValue('anchor-name')).toBe('--hk-invoker');
  });

  it('stamps template content lazily with [hkTooltipData] as $implicit', async () => {
    const fixture = TestBed.createComponent(TemplateHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('button')!;

    // Nothing is instantiated before the first interest.
    expect(tooltipEl().querySelector('.user-card')).toBeNull();

    gainInterest(host);

    expect(tooltipEl().querySelector('.user-card')?.textContent).toContain('User 42');
    // Rich content is a hovercard, not a tooltip, in ARIA terms.
    expect(tooltipEl().hasAttribute('role')).toBe(false);
  });

  it('runs the full component lifecycle when switching between triggers', async () => {
    const fixture = TestBed.createComponent(TwoTriggerHost);
    await fixture.whenStable();
    const [btn, link] = [
      (fixture.nativeElement as Element).querySelector('button')!,
      (fixture.nativeElement as Element).querySelector('a')!,
    ];

    gainInterest(btn);
    expect(lifecycle.inits).toBe(1);
    expect(lifecycle.destroys).toBe(0);
    expect(tooltipEl().querySelector('.probe')).toBeTruthy();

    // Interest moves to the second trigger: A's component is destroyed,
    // the anchor name moves, B's content renders.
    gainInterest(link);
    expect(lifecycle.destroys).toBe(1);
    expect(tooltipEl().querySelector('.probe')).toBeNull();
    expect(tooltipEl().querySelector('.b-card')?.textContent).toBe('B content');
    expect((btn as HTMLElement).style.getPropertyValue('anchor-name')).toBe('');
    expect((link as HTMLElement).style.getPropertyValue('anchor-name')).toBe('--hk-invoker');

    // Back to A: a fresh component instance.
    gainInterest(btn);
    expect(lifecycle.inits).toBe(2);
  });

  it('cancels browser interest for triggers without content yet', async () => {
    @Component({
      imports: [HkTooltip],
      template: `<a href="/docs" hkTooltip="">link</a>`,
    })
    class EmptyHost {}
    const fixture = TestBed.createComponent(EmptyHost);
    await fixture.whenStable();

    const e = gainInterest((fixture.nativeElement as Element).querySelector('a')!);

    // The default action would open the popover empty — must be cancelled.
    expect(e.defaultPrevented).toBe(true);
    expect(tooltipEl().textContent).toBe('');
  });

  it('hands off between invokers without breaking either tooltip', async () => {
    const fixture = TestBed.createComponent(TwoTriggerHost);
    await fixture.whenStable();
    const btn = (fixture.nativeElement as Element).querySelector('button') as HTMLElement;
    const link = (fixture.nativeElement as Element).querySelector('a') as HTMLElement;

    const loseInterest = (source: Element) => {
      const e = new Event('loseinterest', { cancelable: true });
      Object.defineProperty(e, 'source', { value: source });
      tooltipEl().dispatchEvent(e);
      return e;
    };
    const browserHide = () => {
      const e = new Event('beforetoggle');
      Object.defineProperty(e, 'newState', { value: 'closed' });
      tooltipEl().dispatchEvent(e);
    };
    const flushMicrotasks = () => Promise.resolve();

    // Interest moved button → link before interest-delay-end elapsed. The
    // stale loseinterest must NOT be cancelled — a cancelled loseinterest
    // leaves the invoker permanently "interested" and its next hover fires
    // no interest event at all.
    gainInterest(btn);
    gainInterest(link);
    fakeHover.add(link);
    const stale = loseInterest(btn);
    expect(stale.defaultPrevented).toBe(false);
    expect(tooltipEl().querySelector('.b-card')).toBeTruthy();

    // …and whenever the browser's hide actually executes, the beforetoggle
    // guard reopens before the next paint, entrance animation suppressed.
    browserHide();
    await flushMicrotasks();
    expect(tooltipEl().style.animation).toBe('none');
    expect(tooltipEl().querySelector('.b-card')).toBeTruthy();

    // Same stale event with nothing engaged: hide for real — a
    // trigger → trigger → elsewhere sweep must not resurrect a tooltip.
    fakeHover.clear();
    tooltipEl().style.removeProperty('animation');
    loseInterest(btn);
    await flushMicrotasks();
    expect(tooltipEl().textContent).toBe('');
    // a hide arriving with no active trigger must not reopen either
    browserHide();
    await flushMicrotasks();
    expect(tooltipEl().style.animation).toBe('');
  });

  it('destroys the projected view and releases the anchor when the trigger is destroyed', async () => {
    const fixture = TestBed.createComponent(TwoTriggerHost);
    await fixture.whenStable();
    const btn = (fixture.nativeElement as Element).querySelector('button') as HTMLElement;

    gainInterest(btn);
    expect(tooltipEl().querySelector('.probe')).toBeTruthy();

    fixture.destroy();

    expect(lifecycle.destroys).toBe(1);
    expect(tooltipEl().querySelector('.probe')).toBeNull();
    expect(btn.style.getPropertyValue('anchor-name')).toBe('');
  });
});
