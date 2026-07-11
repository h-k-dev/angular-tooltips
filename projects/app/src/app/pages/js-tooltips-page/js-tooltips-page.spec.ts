import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JsTooltipsPage } from './js-tooltips-page';

describe('JsTooltipsPage', () => {
  let component: JsTooltipsPage;
  let fixture: ComponentFixture<JsTooltipsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsTooltipsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(JsTooltipsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
