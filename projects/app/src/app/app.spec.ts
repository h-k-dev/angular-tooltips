import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
      // RouterLink (aside fragment nav) needs a Router at DI time.
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the page navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = [...compiled.querySelectorAll('.aside-nav__link')].map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['Home', 'Anchor Tooltips', 'JS Tooltips', 'Examples']);
  });
});
