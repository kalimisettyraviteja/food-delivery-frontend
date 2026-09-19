import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerOrders } from './manager-orders';

describe('ManagerOrders', () => {
  let component: ManagerOrders;
  let fixture: ComponentFixture<ManagerOrders>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerOrders]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerOrders);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
