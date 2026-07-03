import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HkTooltip } from './angular-tooltips';

@Component({
  imports: [HkTooltip],
  template: `<button hkTooltip="Hello">Hover me</button>`,
})
class Host {}

describe('HkTooltip', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const directive = fixture.debugElement.query(By.directive(HkTooltip));
    expect(directive).toBeTruthy();
    expect(directive.injector.get(HkTooltip).content()).toBe('Hello');
  });
});
