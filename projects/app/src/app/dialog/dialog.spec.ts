import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dialog } from './dialog';

// jsdom knows neither CSS Anchor Positioning nor Interest Invokers; without
// these stubs every [hkTooltip] in the template would throw at construction
// (by design — the library is anchor-native only).
const realCSS = globalThis.CSS;
const INVOKER_PROTOS = [HTMLButtonElement.prototype, HTMLAnchorElement.prototype];
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => true };
  for (const proto of INVOKER_PROTOS) {
    Object.defineProperty(proto, 'interestForElement', {
      value: null,
      writable: true,
      configurable: true,
    });
  }
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
  for (const proto of INVOKER_PROTOS) {
    delete (proto as { interestForElement?: unknown }).interestForElement;
  }
});

describe('Dialog', () => {
  let component: Dialog;
  let fixture: ComponentFixture<Dialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dialog],
    }).compileComponents();

    fixture = TestBed.createComponent(Dialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
