import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injectable,
  inject,

  // Signal
  input,
  signal,
  computed,
} from '@angular/core';

/** The popover's element id — also the `interestfor` target id. */
const TARGET_ID = 'anchor-tooltips';

/**
 * The ONE anchor name the popover (and its arrow pseudo) follows. The
 * service moves it between whichever invoker holds interest — many tags,
 * one bubble, zero per-tag DOM.
 */
const INVOKER_ANCHOR = '--invoker';

@Injectable()
export class InvokerService {
  readonly #labels = new Map<HTMLElement, () => string>();
  readonly #active = signal<{ el: HTMLElement; label: string } | null>(null);

  /** Label of the invoker currently owning the popover. */
  readonly label = computed(() => this.#active()?.label ?? '');

  registerTrigger(el: HTMLElement, label: () => string): () => void {
    this.#labels.set(el, label);
    return () => {
      this.#labels.delete(el);
      if (this.#active()?.el === el) {
        el.style.removeProperty('anchor-name');
        this.#active.set(null);
      }
    };
  }

  /**
   * The service's ONE job: when interest moves to the next invoker,
   * re-point the popover's anchor name. The BROWSER owns everything else —
   * showing, hiding, delays, hover/focus/long-press semantics.
   *
   * The `interest` event fires on the target before it opens, with
   * `source` = the invoker gaining interest.
   */
  attachPopover(el: HTMLElement): void {
    el.addEventListener('interest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source;
      if (src instanceof HTMLElement) this.#point(src);
    });
  }

  /**
   * Moving `anchor-name` is all CSS needs: position-area, position-try and
   * the arrow's anchor() insets re-resolve against the new invoker
   * automatically — even while the popover is open.
   */
  #point(el: HTMLElement): void {
    const prev = this.#active();
    if (prev?.el === el) return;
    prev?.el.style.removeProperty('anchor-name');
    el.style.setProperty('anchor-name', INVOKER_ANCHOR);
    this.#active.set({ el, label: this.#labels.get(el)?.() ?? '' });
  }
}

@Directive({
  selector: '[anchorTooltips]',
  standalone: true,
  host: {
    class: 'example-tooltip-trigger',

    // Browser-native trigger: hover, focus, touch long-press and delays are
    // all the browser's job via interestfor.
    '[attr.interestfor]': 'targetId',
    '[style.interest-delay-start]': 'delayShow()',
  },
})
export class AnchorTooltips {
  readonly #invokers = inject(InvokerService);
  readonly #host = inject(ElementRef<HTMLElement>).nativeElement;

  /** Display label for the popover, e.g. anchorTooltips="<button>". */
  label = input.required<string>({ alias: 'anchorTooltips' });

  delayShow = input('0.3ms');

  protected readonly targetId = TARGET_ID;

  constructor() {
    if (!('interestForElement' in this.#host)) {
      throw new Error(
        `[anchorTooltips] <${this.#host.tagName.toLowerCase()}> does not support ` +
          'interestfor — use a <button> or <a href> host.',
      );
    }

    const unregister = this.#invokers.registerTrigger(this.#host, () => this.label());
    inject(DestroyRef).onDestroy(unregister);
  }
}

/** Marks the popover element the service re-points. */
@Directive({
  selector: '[anchorTooltipsPopover]',
  standalone: true,
})
export class AnchorTooltipsPopover {
  constructor() {
    inject(InvokerService).attachPopover(inject(ElementRef<HTMLElement>).nativeElement);
  }
}

@Component({
  selector: 'app-inspiration-card',
  imports: [AnchorTooltips, AnchorTooltipsPopover],
  // Component-provided: the invoker state lives and dies with this card.
  providers: [InvokerService],
  templateUrl: './inspiration-card.html',
  styleUrl: './inspiration-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class InspirationCard {
  protected readonly invokers = inject(InvokerService);

  content = signal(
    `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since 1966, when designers at Letraset and James Mosley, the librarian at St Bride Printing Library in London, took a 1914 Cicero translation and scrambled it to make dummy text for Letraset's Body Type sheets. It has survived not only many decades, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised thanks to these sheets and more recently with desktop publishing software like Aldus PageMaker and Microsoft Word including versions of Lorem Ipsum.`,
  );
}
