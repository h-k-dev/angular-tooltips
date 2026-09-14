import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App, THEME_STORAGE_KEY } from './app';

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
    expect(labels).toEqual(['Tooltips', 'Invoker', 'JS Anchor', 'Theming', 'API', 'Inspiration']);
  });

  describe('theme', () => {
    const realMatchMedia = window.matchMedia;
    // The test DOM may have no Web Storage — install an in-memory one.
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    };
    const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    beforeAll(() => {
      Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true });
    });
    afterAll(() => {
      if (realStorage) Object.defineProperty(window, 'localStorage', realStorage);
      else delete (window as { localStorage?: unknown }).localStorage;
    });
    const prefersDark = (dark: boolean) => {
      window.matchMedia = ((query: string) =>
        ({
          matches: dark && query.includes('dark'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
    };

    afterEach(() => {
      window.matchMedia = realMatchMedia;
      localStorage.removeItem(THEME_STORAGE_KEY);
    });

    it('defaults to the OS preference when nothing is stored', () => {
      prefersDark(true);
      expect(TestBed.createComponent(App).componentInstance.theme()).toBe('dark');
      prefersDark(false);
      expect(TestBed.createComponent(App).componentInstance.theme()).toBe('light');
    });

    it('prefers a stored choice over the OS preference', () => {
      prefersDark(true);
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      expect(TestBed.createComponent(App).componentInstance.theme()).toBe('light');
    });

    it('ignores an invalid stored value', () => {
      prefersDark(true);
      localStorage.setItem(THEME_STORAGE_KEY, 'purple');
      expect(TestBed.createComponent(App).componentInstance.theme()).toBe('dark');
    });

    it('saves the choice when toggled', () => {
      prefersDark(false);
      const app = TestBed.createComponent(App).componentInstance;
      app.toggleTheme();
      expect(app.theme()).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
  });
});
