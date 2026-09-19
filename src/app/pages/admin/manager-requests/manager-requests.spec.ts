import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerRequests } from './manager-requests';

describe('ManagerRequests', () => {
  let component: ManagerRequests;
  let fixture: ComponentFixture<ManagerRequests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerRequests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
