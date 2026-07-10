import { TestBed } from '@angular/core/testing';
import { App } from './app';

// jsdom has no CSS Anchor Positioning; without this stub every [hkTooltip]
// in the template would throw at construction (by design — see the library's
// strict engine split).
const realCSS = globalThis.CSS;
beforeAll(() => {
  (globalThis as { CSS: unknown }).CSS = { supports: () => true };
});
afterAll(() => {
  (globalThis as { CSS: unknown }).CSS = realCSS;
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Modern Tooltip Playground');
  });
});
