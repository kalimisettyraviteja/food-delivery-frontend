import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RestaurantService } from '../../../core/services/restaurant';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-dashboard.html',
  styleUrl: './manager-dashboard.css'
})
export class ManagerDashboard implements OnInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly router = inject(Router);

  loading = true;
  errorMessage = '';

  totalCount = 0;
  activeCount = 0;
  inactiveCount = 0;

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.loading = true;
    this.errorMessage = '';

    this.restaurantService.getMyRestaurantSummary().subscribe({
      next: response => {
        this.totalCount = response.totalCount ?? 0;
        this.activeCount = response.activeCount ?? 0;
        this.inactiveCount = response.inactiveCount ?? 0;
        this.loading = false;
      },

      error: error => {
        console.error('Failed to load restaurant summary', error);

        this.errorMessage =
          error?.error?.message ||
          'Unable to load restaurant summary. Please try again.';

        this.loading = false;
      }
    });
  }

  openRestaurants(status?: 'ACTIVE' | 'INACTIVE'): void {
    if (!status) {
      this.router.navigate(['/restaurant-manager/restaurants']);
      return;
    }

    this.router.navigate(
      ['/restaurant-manager/restaurants'],
      {
        queryParams: { status }
      }
    );
  }

  openCreateRestaurant(): void {
    this.router.navigate(
      ['/restaurant-manager/restaurants/form'],
      {
        queryParams: { action: 'create' }
      }
    );
  }

  openOrders(): void {
    this.router.navigate(['/restaurant-manager/orders']);
  }
}