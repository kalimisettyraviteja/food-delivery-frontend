import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  RestaurantRatingSummaryResponse,
  ReviewResponse,
  ReviewService
} from '../../../core/services/review';

import {
  Restaurant,
  RestaurantService
} from '../../../core/services/restaurant';

@Component({
  selector: 'app-manager-reviews',
  standalone: true,
imports: [CommonModule, FormsModule],
  templateUrl: './manager-reviews.html',
  styleUrl: './manager-reviews.css'
})
export class ManagerReviews implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly restaurantService = inject(RestaurantService);
  private readonly reviewService = inject(ReviewService);

  restaurant: Restaurant | null = null;
  restaurantId: number | null = null;

  reviews: ReviewResponse[] = [];
  summary: RestaurantRatingSummaryResponse | null = null;

  ratingFilter: number | 'ALL' = 'ALL';

  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const restaurantIdParam = params.get('restaurantId');
      const restaurantId = Number(restaurantIdParam);

      if (!restaurantIdParam || Number.isNaN(restaurantId) || restaurantId <= 0) {
        this.loading = false;
        this.errorMessage =
          'Restaurant ID is missing or invalid. Please open reviews from the Restaurants page.';
        return;
      }

      this.restaurantId = restaurantId;
      this.ratingFilter = 'ALL';
      this.loadReviewPageData();
    });
  }

  loadReviewPageData(): void {
    if (this.restaurantId == null) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.reviews = [];
    this.summary = null;
    this.restaurant = null;

    const restaurantId = this.restaurantId;

    forkJoin({
      restaurant: this.restaurantService.getMyRestaurantById(restaurantId),
      reviews: this.reviewService.getManagerRestaurantReviews(restaurantId),
      summary: this.reviewService.getManagerRestaurantRatingSummary(restaurantId)
    })
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: ({ restaurant, reviews, summary }) => {
          this.restaurant = restaurant;
          this.reviews = reviews ?? [];
          this.summary = summary;
        },

        error: error => {
          console.error('Failed to load manager review page', error);

          if (error.status === 401) {
            this.errorMessage =
              'Your session has expired. Please log in again.';
          } else if (error.status === 403) {
            this.errorMessage =
              'You do not have permission to view reviews for this restaurant.';
          } else if (error.status === 404) {
            this.errorMessage =
              'Restaurant not found or you do not have access to it.';
          } else {
            this.errorMessage =
              'Unable to load reviews and ratings. Please try again.';
          }
        }
      });
  }

  refresh(): void {
    this.loadReviewPageData();
  }

  goBackToRestaurants(): void {
    this.router.navigate(['/restaurant-manager/restaurants']);
  }

  get filteredReviews(): ReviewResponse[] {
    if (this.ratingFilter === 'ALL') {
      return this.reviews;
    }

    return this.reviews.filter(review => review.rating === this.ratingFilter);
  }

  getRatingCount(rating: number): number {
    return this.reviews.filter(review => review.rating === rating).length;
  }

  getRatingPercentage(rating: number): number {
    if (this.reviews.length === 0) {
      return 0;
    }

    return (this.getRatingCount(rating) / this.reviews.length) * 100;
  }

  ratingArray(rating: number): number[] {
    return Array.from(
      {
        length: Math.max(0, Math.min(5, rating))
      },
      (_, index) => index
    );
  }

  emptyStarArray(rating: number): number[] {
    return Array.from(
      {
        length: Math.max(0, 5 - rating)
      },
      (_, index) => index
    );
  }

  isActive(): boolean {
    return this.restaurant?.isActive === true;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  formatRating(rating: number | null | undefined): string {
    if (rating == null) {
      return '0.0';
    }

    return Number(rating).toFixed(1);
  }

  maskEmail(email: string | null | undefined): string {
    if (!email) {
      return 'Customer';
    }

    const atIndex = email.indexOf('@');

    if (atIndex <= 1) {
      return 'Customer';
    }

    const namePart = email.substring(0, atIndex);
    const domainPart = email.substring(atIndex);

    return `${namePart.substring(0, 2)}***${domainPart}`;
  }

  trackByReviewId(
    _index: number,
    review: ReviewResponse
  ): number {
    return review.id;
  }
}