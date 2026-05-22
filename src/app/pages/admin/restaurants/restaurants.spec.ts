import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Restaurants } from './restaurants';

describe('Restaurants', () => {
  let component: Restaurants;
  let fixture: ComponentFixture<Restaurants>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Restaurants]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Restaurants);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
