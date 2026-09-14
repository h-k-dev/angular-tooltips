import { inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type CodeLang = 'angular-html' | 'angular-ts' | 'scss' | 'css' | 'bash' | 'json';

/**
 * Shiki highlighting shared by the demo's code panes. Shiki loads lazily on
 * the first call. Dual themes: light colours inline, dark ones ride
 * --shiki-dark under the app's .dark-mode class (styles.scss).
 *
 * Must be created in an injection context (it injects DomSanitizer).
 */
export function injectHighlighter(): (code: string, lang: CodeLang) => Promise<SafeHtml> {
  const sanitizer = inject(DomSanitizer);
  return (code, lang) =>
    import('shiki')
      .then(({ codeToHtml }) =>
        codeToHtml(code, { lang, themes: { light: 'github-light', dark: 'github-dark' } }),
      )
      // Trusted: generated locally by Shiki from our own strings and files.
      .then((html) => sanitizer.bypassSecurityTrustHtml(html));
}
