import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerOrderDetail } from './manager-order-detail';

describe('ManagerOrderDetail', () => {
  let component: ManagerOrderDetail;
  let fixture: ComponentFixture<ManagerOrderDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerOrderDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerOrderDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
