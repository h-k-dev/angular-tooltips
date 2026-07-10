import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dialog } from './dialog';

// jsdom has no CSS Anchor Positioning; without this stub every [hkTooltip]
// in the template would throw at construction (by design).
const realCSS = globalThis.CSS;
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => true };
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
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
