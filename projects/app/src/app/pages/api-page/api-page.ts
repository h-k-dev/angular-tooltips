import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CodeBlock } from '../../code/code-block';

interface Row {
  name: string;
  type?: string;
  default?: string;
  description: string;
}

/**
 * API reference for the public surface in `public-api.ts`. Mirrors the
 * README's API section — keep the two in sync when the API changes.
 */
@Component({
  selector: 'app-api-page',
  imports: [NgTemplateOutlet, RouterLink, CodeBlock],
  templateUrl: './api-page.html',
  styleUrl: './api-page.scss',
})
export class ApiPage {
  protected readonly sections = [
    { id: 'directives', label: 'Directives' },
    { id: 'inputs', label: 'Inputs' },
    { id: 'methods', label: 'Methods' },
    { id: 'types', label: 'Types' },
    { id: 'functions', label: 'Functions' },
    { id: 'cache', label: 'HkTooltipCache' },
  ];

  protected readonly usage = `import { Component } from '@angular/core';
import { HkTooltip, HkJsTooltip } from '@h-k-dev/angular-tooltips';

@Component({
  selector: 'app-demo',
  imports: [HkTooltip, HkJsTooltip],
  template: \`
    <!-- invoker engine: <button>, <a href>, <area href> -->
    <button hkTooltip="Save your progress" hkTooltipShowDelay="300">Save</button>

    <!-- JS engine: every other element -->
    <span tabindex="0" hkJsTooltip="Last synced 2 min ago" hkTooltipPlacement="bottom">
      status
    </span>

    <!-- programmatic control, same on both -->
    <button #tip="hkTooltip" hkTooltip="Copied!" (click)="tip.show(0)">Copy</button>
  \`,
})
export class Demo {}`;

  protected readonly directives = [
    {
      selector: '[hkTooltip]',
      className: 'HkTooltip',
      engine: 'invoker',
      exportAs: 'hkTooltip',
      hosts: '<button>, <a href>, <area href>',
      throws:
        'without CSS Anchor Positioning or Interest Invokers, or on a host that cannot be an interest invoker',
    },
    {
      selector: '[hkJsTooltip]',
      className: 'HkJsTooltip',
      engine: 'js',
      exportAs: 'hkJsTooltip',
      hosts: 'any other element or component host',
      throws: 'without CSS Anchor Positioning, or on a host that IS an interest invoker',
    },
  ];

  protected readonly inputs: Row[] = [
    {
      name: 'hkTooltip / hkJsTooltip',
      type: 'string | TemplateRef<HkTooltipContext>',
      default: 'required',
      description:
        'Tooltip text, or a template stamped lazily on show. An empty string never opens.',
    },
    {
      name: 'hkTooltipData',
      type: 'unknown',
      default: 'undefined',
      description: "The template's implicit let variable ($implicit).",
    },
    {
      name: 'hkTooltipPlacement',
      type: "'top' | 'bottom' | 'left' | 'right'",
      default: "'top'",
      description: 'Preferred side; flips when that side runs out of viewport.',
    },
    {
      name: 'hkTooltipShowDelay',
      type: 'number (ms)',
      default: '0',
      description: 'Delay before showing. Invoker engine: CSS interest-delay-start.',
    },
    {
      name: 'hkTooltipHideDelay',
      type: 'number (ms)',
      default: '80',
      description: 'Delay before hiding. Invoker engine: CSS interest-delay-end.',
    },
    {
      name: 'hkTooltipDisabled',
      type: 'boolean',
      default: 'false',
      description: 'Never shows while true, and hides if currently open.',
    },
  ];

  protected readonly members: Row[] = [
    {
      name: 'show(delay?)',
      type: '(delay?: number) => void',
      default: 'showDelay',
      description: 'Open after delay ms. Stays open until hide(), the trigger’s own hide path, or (JS engine) Escape / a pointerdown outside.',
    },
    {
      name: 'hide(delay?)',
      type: '(delay?: number) => void',
      default: 'hideDelay',
      description: 'Close after delay ms — only if this trigger is the one shown.',
    },
    { name: 'toggle()', type: '() => void', description: 'show(0) or hide(0).' },
    {
      name: 'isVisible()',
      type: '() => boolean',
      description: 'Whether the singleton is currently open for this trigger.',
    },
    {
      name: 'engine',
      type: "'invoker' | 'js'",
      description: 'Which engine triggers this tooltip.',
    },
    {
      name: 'hostEl',
      type: 'HTMLElement',
      description: 'The host; carries the anchor name while this trigger is shown.',
    },
  ];

  protected readonly triggerInterface = `export interface HkTooltipTrigger {
  readonly hostEl: HTMLElement;
  readonly engine: TooltipEngine;

  readonly content: Signal<HkTooltipContent>;
  readonly data: Signal<unknown>;
  readonly placement: Signal<TooltipPlacement>;
  readonly showDelay: Signal<number>;
  readonly hideDelay: Signal<number>;
  readonly disabled: Signal<boolean>;

  show(delay?: number): void;
  hide(delay?: number): void;
  toggle(): void;
  isVisible(): boolean;
}`;

  protected readonly types: Row[] = [
    {
      name: 'HkTooltipTrigger',
      description: 'The contract both directives implement (above).',
    },
    {
      name: 'HkTooltipContent',
      type: 'string | TemplateRef<HkTooltipContext>',
      description: 'What the content input accepts.',
    },
    {
      name: 'HkTooltipContext<T>',
      type: '{ $implicit: T }',
      description: 'Template context; $implicit is hkTooltipData.',
    },
    { name: 'TooltipPlacement', type: "'top' | 'bottom' | 'left' | 'right'", description: 'Preferred side.' },
    { name: 'TooltipEngine', type: "'invoker' | 'js'", description: 'Trigger engine.' },
    {
      name: 'HkTooltipBase',
      type: 'abstract directive',
      description: 'Shared implementation of the inputs and methods — extend it only to build a third engine.',
    },
    {
      name: 'TooltipsManager',
      type: 'service (root)',
      description: 'Owns the singleton popover, its content and the anchor name. Used by the directives; app code does not need it.',
    },
  ];

  protected readonly functions: Row[] = [
    {
      name: 'supportsAnchorPositioning()',
      type: '() => boolean',
      description: 'CSS Anchor Positioning available — required by both engines.',
    },
    {
      name: 'supportsInterestInvokers()',
      type: '() => boolean',
      description: 'Interest Invokers (interestfor) available — required by hkTooltip.',
    },
    {
      name: 'isInterestInvoker(el)',
      type: '(el: Element) => boolean',
      description: 'Whether el can be an invoker, i.e. which directive it takes.',
    },
    {
      name: 'TOOLTIP_ID',
      type: "'hk-tooltip'",
      description: 'Id of the singleton popover (the interestfor target).',
    },
  ];

  protected readonly cache: Row[] = [
    {
      name: 'getOrFetch(key, fetcher, ttl?)',
      type: '<T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>',
      description: 'Cached promise for key, or run fetcher and cache it. Concurrent callers share one request; rejections are evicted.',
    },
    { name: 'invalidate(key)', type: '(key: string) => void', description: 'Drop one entry.' },
    {
      name: 'invalidatePrefix(prefix)',
      type: '(prefix: string) => void',
      description: 'Drop every entry whose key starts with prefix.',
    },
    { name: 'clear()', type: '() => void', description: 'Drop everything.' },
    {
      name: 'provideHkTooltipCache(options)',
      type: '({ ttl?, maxEntries? }) => Provider[]',
      default: 'ttl 30 000 ms, maxEntries 100',
      description: 'Configure the cache in bootstrapApplication or a component’s providers.',
    },
  ];
}
