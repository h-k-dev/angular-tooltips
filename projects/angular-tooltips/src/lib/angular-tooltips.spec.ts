import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AngularTooltip } from './angular-tooltips';

@Component({
  imports: [AngularTooltip],
  template: `<button ngTooltip="Hello">Hover me</button>`,
})
class Host {}

describe('AngularTooltip', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const directive = fixture.debugElement.query(By.directive(AngularTooltip));
    expect(directive).toBeTruthy();
    expect(directive.injector.get(AngularTooltip).content()).toBe('Hello');
  });
});
