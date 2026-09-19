import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Restaurant,
  RestaurantService
} from '../../../core/services/restaurant';

@Component({
  selector: 'app-manager-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-restaurants.html',
  styleUrl: './manager-restaurants.css'
})
export class ManagerRestaurants implements OnInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  deleting = false;
  errorMessage = '';

  restaurants: Restaurant[] = [];
  filteredRestaurants: Restaurant[] = [];
  cuisines: string[] = [];

  searchTerm = '';
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  cuisineFilter = 'ALL';
  foodTypeFilter = 'ALL';

  openActionId: number | null = null;
  restaurantToDelete: Restaurant | null = null;

  get activeCount(): number {
    return this.restaurants.filter(
      restaurant => this.isActive(restaurant)
    ).length;
  }

  get inactiveCount(): number {
    return this.restaurants.length - this.activeCount;
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const status = params.get('status');

      this.statusFilter =
        status === 'ACTIVE' || status === 'INACTIVE'
          ? status
          : 'ALL';

      this.loadRestaurants();
    });
  }

  loadRestaurants(): void {
    this.loading = true;
    this.errorMessage = '';
    this.openActionId = null;

    const status =
      this.statusFilter === 'ALL'
        ? undefined
        : this.statusFilter;

    this.restaurantService.getManagerRestaurants(status).subscribe({
      next: restaurants => {
        this.restaurants = restaurants ?? [];

        this.cuisines = [
          ...new Set(
            this.restaurants
              .map(restaurant => restaurant.cuisine?.trim())
              .filter(
                (cuisine): cuisine is string => Boolean(cuisine)
              )
          )
        ].sort();

        this.applyFilters();
        this.loading = false;
      },

      error: err => {
        this.errorMessage =
          err?.error?.message ||
          'Unable to load restaurants.';

        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredRestaurants = this.restaurants.filter(restaurant => {
      const matchesSearch =
        !search ||
        [
          restaurant.name,
          restaurant.cuisine,
          restaurant.location
        ].some(value =>
          String(value ?? '').toLowerCase().includes(search)
        );

      const matchesCuisine =
        this.cuisineFilter === 'ALL' ||
        restaurant.cuisine === this.cuisineFilter;

      const matchesFoodType =
        this.foodTypeFilter === 'ALL' ||
        this.getFoodTypeKey(restaurant) === this.foodTypeFilter;

      return matchesSearch && matchesCuisine && matchesFoodType;
    });
  }

  setStatusFilter(status: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
    this.statusFilter = status;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: status === 'ALL' ? { status: null } : { status },
      queryParamsHandling: 'merge'
    });
  }

  createRestaurant(): void {
    this.router.navigate(['/restaurant-manager/restaurants/form'], {
      queryParams: { action: 'create' }
    });
  }

  editRestaurant(restaurant: Restaurant): void {
    this.openActionId = null;

    if (!restaurant.id) {
      return;
    }

    this.router.navigate(['/restaurant-manager/restaurants/form'], {
      queryParams: {
        action: 'edit',
        id: restaurant.id
      }
    });
  }

  viewMenu(restaurant: Restaurant): void {
    this.openActionId = null;

    if (!restaurant.id) {
      return;
    }

    this.router.navigate([
      '/restaurant-manager/restaurants',
      restaurant.id,
      'menu'
    ]);
  }

  manageCoupons(restaurant: Restaurant): void {
    this.openActionId = null;

    if (!restaurant.id) {
      return;
    }

    this.router.navigate(
      ['/restaurant-manager/coupons'],
      {
        queryParams: {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name
        }
      }
    );
  }

  viewReviews(restaurant: Restaurant): void {
    this.openActionId = null;

    if (!restaurant.id) {
      return;
    }

    this.router.navigate(
      ['/restaurant-manager/reviews'],
      {
        queryParams: {
          restaurantId: restaurant.id
        }
      }
    );
  }

  askDelete(restaurant: Restaurant): void {
    this.openActionId = null;
    this.restaurantToDelete = restaurant;
  }

  cancelDelete(): void {
    if (!this.deleting) {
      this.restaurantToDelete = null;
    }
  }

  confirmDelete(): void {
    if (!this.restaurantToDelete?.id || this.deleting) {
      return;
    }

    const restaurantId = this.restaurantToDelete.id;
    this.deleting = true;

    this.restaurantService.deleteAsManager(restaurantId).subscribe({
      next: () => {
        this.restaurants = this.restaurants.filter(
          restaurant => restaurant.id !== restaurantId
        );

        this.applyFilters();
        this.restaurantToDelete = null;
        this.deleting = false;
      },

      error: err => {
        this.errorMessage =
          err?.error?.message ||
          'Unable to delete restaurant.';

        this.deleting = false;
      }
    });
  }

  toggleActions(id: number | undefined, event: Event): void {
    event.stopPropagation();

    if (!id) {
      return;
    }

    this.openActionId =
      this.openActionId === id
        ? null
        : id;
  }

  @HostListener('document:click')
  closeActions(): void {
    this.openActionId = null;
  }

  isActive(restaurant: Restaurant): boolean {
    return restaurant.isActive === true;
  }

  getFoodTypeKey(restaurant: Restaurant): string {
    return restaurant.isPureVeg === true
      ? 'PURE_VEG'
      : 'BOTH';
  }

  getFoodTypeLabel(restaurant: Restaurant): string {
    return restaurant.isPureVeg === true
      ? 'Pure veg'
      : 'Veg & non-veg';
  }

  getLocation(restaurant: Restaurant): string {
    return restaurant.location || '—';
  }

  trackByRestaurantId(
    _index: number,
    restaurant: Restaurant
  ): number | undefined {
    return restaurant.id;
  }
}