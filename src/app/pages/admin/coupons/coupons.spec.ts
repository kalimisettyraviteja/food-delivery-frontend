import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Coupons } from './coupons';

describe('Coupons', () => {
  let component: Coupons;
  let fixture: ComponentFixture<Coupons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Coupons]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Coupons);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
