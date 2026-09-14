import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HkTooltip, TOOLTIP_ID } from './angular-tooltips';
import { HkJsTooltip } from './js-tooltips';

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

@Component({
  imports: [HkTooltip],
  template: `<button [hkTooltip]="text()" [hkTooltipPlacement]="side()">live</button>`,
})
class LiveHost {
  text = signal('one');
  side = signal<'top' | 'bottom'>('top');
}

@Component({
  imports: [HkJsTooltip],
  template: `<span hkJsTooltip="Span tip" hkTooltipShowDelay="50" hkTooltipHideDelay="30">js</span>`,
})
class JsHost {}

@Component({
  imports: [HkTooltip, HkJsTooltip],
  template: `
    <button hkTooltip="invoker tip">A</button>
    <span hkJsTooltip="js tip" hkTooltipHideDelay="30">B</span>
  `,
})
class MixedHost {}

// The test DOM knows neither CSS Anchor Positioning, Interest Invokers, the
// Popover API, nor the :popover-open pseudo-class. `anchorSupported` steers
// the lazy supportsAnchorPositioning() check; `interestForElement` is
// stubbed onto the REAL invoker prototypes only, so host-compatibility
// checks behave like the platform. showPopover/hidePopover keep a fake
// open flag that :popover-open reports; :hover / :focus-within /
// :focus-visible report engagement from the fakeHover set so tests can
// steer the handoff logic.
let anchorSupported = true;
const fakeHover = new Set<Element>();
const openPopovers = new WeakSet<Element>();
const realCSS = globalThis.CSS;
const realMatches = Element.prototype.matches;
const realShow = HTMLElement.prototype.showPopover;
const realHide = HTMLElement.prototype.hidePopover;
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
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    openPopovers.add(this);
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    openPopovers.delete(this);
  };
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':popover-open') return openPopovers.has(this);
    if (selector === ':hover' || selector === ':focus-within' || selector === ':focus-visible') {
      return fakeHover.has(this);
    }
    return realMatches.call(this, selector);
  } as typeof Element.prototype.matches;
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
  for (const proto of INVOKER_PROTOS) {
    delete (proto as { interestForElement?: unknown }).interestForElement;
  }
  HTMLElement.prototype.showPopover = realShow;
  HTMLElement.prototype.hidePopover = realHide;
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

function loseInterest(source: Element): Event {
  const e = new Event('loseinterest', { cancelable: true });
  Object.defineProperty(e, 'source', { value: source });
  tooltipEl().dispatchEvent(e);
  return e;
}

/**
 * The browser closing the popover on its own (stale interest loss):
 * beforetoggle fires INSIDE the hide (still :popover-open), the state flips,
 * and the toggle event follows as its own task.
 */
function browserHide(): void {
  const before = new Event('beforetoggle');
  Object.defineProperty(before, 'newState', { value: 'closed' });
  tooltipEl().dispatchEvent(before);
  openPopovers.delete(tooltipEl());
  const toggle = new Event('toggle');
  Object.defineProperty(toggle, 'newState', { value: 'closed' });
  tooltipEl().dispatchEvent(toggle);
}

const flushMicrotasks = () => Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('HkTooltip (invoker engine)', () => {
  it('should create and wire the interestfor trigger', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const de = fixture.debugElement.query(By.directive(HkTooltip));
    expect(de.injector.get(HkTooltip).content()).toBe('Hello');
    expect(de.injector.get(HkTooltip).engine).toBe('invoker');
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
    }).toThrowError(/hkJsTooltip/);
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

    const genA = tooltipEl().getAttribute('data-try-gen');
    expect(genA).toMatch(/^[ab]$/);

    // Interest moves to the second trigger: A's component is destroyed,
    // the anchor name moves, B's content renders, and the position-try
    // generation flips so the browser forgets A's fallback side.
    gainInterest(link);
    expect(tooltipEl().getAttribute('data-try-gen')).not.toBe(genA);
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

  it('cancels browser interest and drops interestfor while disabled', async () => {
    @Component({
      imports: [HkTooltip],
      template: `<button hkTooltip="tip" [hkTooltipDisabled]="disabled()">x</button>`,
    })
    class DisabledHost {
      disabled = signal(true);
    }
    const fixture = TestBed.createComponent(DisabledHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('button')!;

    expect(host.hasAttribute('interestfor')).toBe(false);
    expect(gainInterest(host).defaultPrevented).toBe(true);

    fixture.componentInstance.disabled.set(false);
    await fixture.whenStable();
    expect(host.getAttribute('interestfor')).toBe(TOOLTIP_ID);
    expect(gainInterest(host).defaultPrevented).toBe(false);
  });

  it('releases the anchor name on a real hide — a later trigger never inherits a stale one', async () => {
    const fixture = TestBed.createComponent(TwoTriggerHost);
    await fixture.whenStable();
    const btn = (fixture.nativeElement as Element).querySelector('button') as HTMLElement;
    const link = (fixture.nativeElement as Element).querySelector('a') as HTMLElement;

    // Hover A, leave A completely (loseinterest with nothing engaged) …
    gainInterest(btn);
    loseInterest(btn);
    expect(btn.style.getPropertyValue('anchor-name')).toBe('');

    // … then hover B: only B may carry the anchor name. (Two hosts with the
    // same anchor-name resolve to the LAST one in tree order — the bubble
    // would render next to the wrong element.)
    gainInterest(link);
    expect(btn.style.getPropertyValue('anchor-name')).toBe('');
    expect(link.style.getPropertyValue('anchor-name')).toBe('--hk-invoker');

    // The browser closing the popover (nothing engaged) releases it too.
    browserHide();
    expect(link.style.getPropertyValue('anchor-name')).toBe('');
  });

  it('re-renders content and placement live while open', async () => {
    const fixture = TestBed.createComponent(LiveHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('button')!;

    gainInterest(host);
    expect(tooltipEl().textContent).toBe('one');

    fixture.componentInstance.text.set('two');
    fixture.componentInstance.side.set('bottom');
    await fixture.whenStable();

    expect(tooltipEl().textContent).toBe('two');
    expect(tooltipEl().getAttribute('data-placement-pref')).toBe('bottom');
  });

  it('hands off between invokers without breaking either tooltip', async () => {
    const fixture = TestBed.createComponent(TwoTriggerHost);
    await fixture.whenStable();
    const btn = (fixture.nativeElement as Element).querySelector('button') as HTMLElement;
    const link = (fixture.nativeElement as Element).querySelector('a') as HTMLElement;

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

    // …and whenever the browser's hide actually executes, the reopen guard
    // restores the popover before the next paint, entrance animation
    // suppressed. (The reopen must NOT happen from inside beforetoggle.)
    const before = new Event('beforetoggle');
    Object.defineProperty(before, 'newState', { value: 'closed' });
    tooltipEl().dispatchEvent(before);
    await flushMicrotasks();
    expect(tooltipEl().style.animation).toBe('');
    openPopovers.delete(tooltipEl());
    const toggle = new Event('toggle');
    Object.defineProperty(toggle, 'newState', { value: 'closed' });
    tooltipEl().dispatchEvent(toggle);
    expect(tooltipEl().style.animation).toBe('none');
    expect(tooltipEl().matches(':popover-open')).toBe(true);
    expect(tooltipEl().querySelector('.b-card')).toBeTruthy();

    // Same stale event with nothing engaged: hide for real — a
    // trigger → trigger → elsewhere sweep must not resurrect a tooltip.
    fakeHover.clear();
    tooltipEl().style.removeProperty('animation');
    loseInterest(btn);
    expect(tooltipEl().textContent).toBe('');
    // a hide arriving with no active trigger must not reopen either
    browserHide();
    await sleep(30); // past any rAF/timeout fallback
    expect(tooltipEl().style.animation).toBe('');
    expect(tooltipEl().matches(':popover-open')).toBe(false);
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

describe('HkJsTooltip (JS engine)', () => {
  it('throws at construction on a host that IS an interest invoker', () => {
    @Component({
      imports: [HkJsTooltip],
      template: `<button hkJsTooltip="nope">btn</button>`,
    })
    class ButtonHost {}
    expect(() => {
      const fixture = TestBed.createComponent(ButtonHost);
      fixture.detectChanges();
    }).toThrowError(/use `hkTooltip`/);
  });

  it('shows on pointerenter after the show delay and hides after the hide delay', async () => {
    const fixture = TestBed.createComponent(JsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('span') as HTMLElement;
    const dir = fixture.debugElement.query(By.directive(HkJsTooltip)).injector.get(HkJsTooltip);

    expect(dir.engine).toBe('js');
    expect(host.hasAttribute('interestfor')).toBe(false);

    host.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    expect(tooltipEl().matches(':popover-open')).toBe(false);
    await sleep(60);
    expect(tooltipEl().matches(':popover-open')).toBe(true);
    expect(tooltipEl().textContent).toBe('Span tip');
    expect(host.style.getPropertyValue('anchor-name')).toBe('--hk-invoker');
    expect(dir.isVisible()).toBe(true);

    host.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    expect(tooltipEl().matches(':popover-open')).toBe(true);
    await sleep(40);
    expect(tooltipEl().matches(':popover-open')).toBe(false);
    expect(host.style.getPropertyValue('anchor-name')).toBe('');
    expect(dir.isVisible()).toBe(false);
  });

  it('leaving and re-entering before the hide delay keeps it open', async () => {
    const fixture = TestBed.createComponent(JsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('span') as HTMLElement;
    const dir = fixture.debugElement.query(By.directive(HkJsTooltip)).injector.get(HkJsTooltip);

    dir.show(0);
    host.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    host.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await sleep(60);
    expect(tooltipEl().matches(':popover-open')).toBe(true);
  });

  it('hovering the popover sustains a JS tooltip; Escape and pointerdown outside dismiss it', async () => {
    const fixture = TestBed.createComponent(JsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('span') as HTMLElement;
    const dir = fixture.debugElement.query(By.directive(HkJsTooltip)).injector.get(HkJsTooltip);

    dir.show(0);
    host.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    tooltipEl().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await sleep(40);
    expect(tooltipEl().matches(':popover-open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tooltipEl().matches(':popover-open')).toBe(false);

    dir.show(0);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(tooltipEl().matches(':popover-open')).toBe(false);

    // …but a pointerdown ON the host (a tap) does not.
    dir.show(0);
    host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(tooltipEl().matches(':popover-open')).toBe(true);
  });

  it('shows on keyboard focus only and hides on blur', async () => {
    const fixture = TestBed.createComponent(JsHost);
    await fixture.whenStable();
    const host = (fixture.nativeElement as Element).querySelector('span') as HTMLElement;

    // Mouse focus: not :focus-visible → nothing.
    host.dispatchEvent(new FocusEvent('focusin'));
    expect(tooltipEl().matches(':popover-open')).toBe(false);

    fakeHover.add(host); // :focus-visible
    host.dispatchEvent(new FocusEvent('focusin'));
    expect(tooltipEl().matches(':popover-open')).toBe(true);

    fakeHover.clear();
    host.dispatchEvent(new FocusEvent('focusout'));
    await sleep(40);
    expect(tooltipEl().matches(':popover-open')).toBe(false);
  });

  it('shares the programmatic API with the invoker engine', async () => {
    const fixture = TestBed.createComponent(MixedHost);
    await fixture.whenStable();
    const invoker = fixture.debugElement.query(By.directive(HkTooltip)).injector.get(HkTooltip);
    const js = fixture.debugElement.query(By.directive(HkJsTooltip)).injector.get(HkJsTooltip);

    invoker.toggle();
    expect(invoker.isVisible()).toBe(true);
    expect(tooltipEl().textContent).toBe('invoker tip');

    js.toggle();
    expect(js.isVisible()).toBe(true);
    expect(invoker.isVisible()).toBe(false);
    expect(tooltipEl().textContent).toBe('js tip');

    js.toggle();
    expect(js.isVisible()).toBe(false);
    expect(tooltipEl().matches(':popover-open')).toBe(false);
  });

  it('blends: invoker → JS handoff survives the stale interest loss, JS → invoker moves the anchor', async () => {
    const fixture = TestBed.createComponent(MixedHost);
    await fixture.whenStable();
    const btn = (fixture.nativeElement as Element).querySelector('button') as HTMLElement;
    const span = (fixture.nativeElement as Element).querySelector('span') as HTMLElement;

    // Pointer on the invoker, then straight onto the JS trigger.
    gainInterest(btn);
    span.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    fakeHover.add(span);
    expect(tooltipEl().textContent).toBe('js tip');
    expect(btn.style.getPropertyValue('anchor-name')).toBe('');
    expect(span.style.getPropertyValue('anchor-name')).toBe('--hk-invoker');

    // The invoker's interest-delay-end fires late: stale loseinterest, then
    // the browser's hide. The JS tooltip must come straight back, no animation.
    loseInterest(btn);
    browserHide();
    expect(tooltipEl().matches(':popover-open')).toBe(true);
    expect(tooltipEl().textContent).toBe('js tip');
    expect(tooltipEl().style.animation).toBe('none');

    // Back onto the invoker: its interest re-points the singleton; the JS
    // trigger's pending hide is a no-op because it is no longer active.
    span.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    fakeHover.clear();
    gainInterest(btn);
    expect(tooltipEl().textContent).toBe('invoker tip');
    expect(span.style.getPropertyValue('anchor-name')).toBe('');
    expect(btn.style.getPropertyValue('anchor-name')).toBe('--hk-invoker');
    await sleep(40);
    expect(tooltipEl().matches(':popover-open')).toBe(true);
  });
});
