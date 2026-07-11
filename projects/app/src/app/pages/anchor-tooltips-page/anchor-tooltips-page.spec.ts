import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnchorTooltipsPage } from './anchor-tooltips-page';

describe('AnchorTooltipsPage', () => {
  let component: AnchorTooltipsPage;
  let fixture: ComponentFixture<AnchorTooltipsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnchorTooltipsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AnchorTooltipsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
