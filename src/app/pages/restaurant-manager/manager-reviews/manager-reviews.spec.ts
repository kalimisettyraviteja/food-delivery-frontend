import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerReviews } from './manager-reviews';

describe('ManagerReviews', () => {
  let component: ManagerReviews;
  let fixture: ComponentFixture<ManagerReviews>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerReviews]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerReviews);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
