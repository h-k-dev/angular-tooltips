import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AngularTooltip } from './angular-tooltips';

describe('AngularTooltip', () => {
  let component: AngularTooltip;
  let fixture: ComponentFixture<AngularTooltip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AngularTooltip],
    }).compileComponents();

    fixture = TestBed.createComponent(AngularTooltip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
