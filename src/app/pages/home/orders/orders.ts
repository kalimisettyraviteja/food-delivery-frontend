import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import {
  OrderResponse,
  OrderService,
  OrderStatus,
  OrderSummaryResponse
} from '../../../core/services/order';
import { FormsModule } from '@angular/forms';
import { ReviewResponse, ReviewService } from '../../../core/services/review';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  private orderService = inject(OrderService);
  private reviewService = inject(ReviewService);

  loading = signal(true);
  detailsLoadingId = signal<number | null>(null);

  orders = signal<OrderSummaryResponse[]>([]);
  expandedOrderId = signal<number | null>(null);

  orderDetailsMap = signal<Record<number, OrderResponse>>({});

  reviewRating = signal<Record<number, number>>({});
  reviewText = signal<Record<number, string>>({});
  reviewSubmitting = signal<Record<number, boolean>>({});
  reviewMap = signal<Record<number, ReviewResponse>>({});
  reviewLoadingMap = signal<Record<number, boolean>>({});

  filter = signal<'ALL' | OrderStatus>('ALL');

  filteredOrders = computed(() => {
    const currentFilter = this.filter();
    const list = this.orders();

    if (currentFilter === 'ALL') {
      return list;
    }

    return list.filter(order => order.status === currentFilter);
  });

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);

    this.orderService.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  toggleOrder(orderId: number) {
    if (this.expandedOrderId() === orderId) {
      this.expandedOrderId.set(null);
      return;
    }

    this.expandedOrderId.set(orderId);

    if (this.orderDetailsMap()[orderId]) {
      this.loadReviewIfNeeded(orderId);
      return;
    }

    this.detailsLoadingId.set(orderId);

    this.orderService.getOrderById(orderId).subscribe({
      next: (data) => {
        this.orderDetailsMap.set({
          ...this.orderDetailsMap(),
          [orderId]: data
        });
        this.detailsLoadingId.set(null);

        this.loadReviewIfNeeded(orderId);
      },
      error: () => {
        this.detailsLoadingId.set(null);
      }
    });
  }

  loadReviewIfNeeded(orderId: number) {
    const detail = this.orderDetailsMap()[orderId];

    if (!detail || detail.status !== 'DELIVERED') {
      return;
    }

    if (this.reviewMap()[orderId] || this.reviewLoadingMap()[orderId]) {
      return;
    }

    this.reviewLoadingMap.set({
      ...this.reviewLoadingMap(),
      [orderId]: true
    });

    this.reviewService.getReviewByOrderId(orderId).subscribe({
      next: (review) => {
        this.reviewMap.set({
          ...this.reviewMap(),
          [orderId]: review
        });

        this.reviewRating.set({
          ...this.reviewRating(),
          [orderId]: review.rating
        });

        this.reviewText.set({
          ...this.reviewText(),
          [orderId]: review.reviewText || ''
        });

        this.reviewLoadingMap.set({
          ...this.reviewLoadingMap(),
          [orderId]: false
        });
      },
      error: () => {
        this.reviewLoadingMap.set({
          ...this.reviewLoadingMap(),
          [orderId]: false
        });
      }
    });
  }

  getOrderDetails(orderId: number): OrderResponse | null {
    return this.orderDetailsMap()[orderId] ?? null;
  }

  getExistingReview(orderId: number): ReviewResponse | null {
    return this.reviewMap()[orderId] ?? null;
  }

  hasReview(orderId: number): boolean {
    return !!this.reviewMap()[orderId];
  }

  isReviewLoading(orderId: number): boolean {
    return !!this.reviewLoadingMap()[orderId];
  }

  isSubmittingReview(orderId: number): boolean {
    return !!this.reviewSubmitting()[orderId];
  }

  setFilter(value: 'ALL' | OrderStatus) {
    this.filter.set(value);
  }

  getStatusClass(status: OrderStatus): string {
    switch (status) {
      case 'DELIVERED':
        return 'status-delivered';
      case 'CANCELLED':
        return 'status-cancelled';
      case 'OUT_FOR_DELIVERY':
        return 'status-out';
      case 'PREPARING':
        return 'status-preparing';
      case 'CONFIRMED':
        return 'status-confirmed';
      default:
        return 'status-placed';
    }
  }

  setRating(orderId: number, rating: number) {
    if (this.hasReview(orderId)) return;

    this.reviewRating.set({
      ...this.reviewRating(),
      [orderId]: rating
    });
  }

  updateReview(orderId: number, text: string) {
    if (this.hasReview(orderId)) return;

    this.reviewText.set({
      ...this.reviewText(),
      [orderId]: text
    });
  }

  submitReview(orderId: number) {
    if (this.hasReview(orderId)) {
      return;
    }

    const rating = this.reviewRating()[orderId];
    const reviewText = (this.reviewText()[orderId] || '').trim();

    if (!rating) {
      alert('Please select a rating first.');
      return;
    }

    this.reviewSubmitting.set({
      ...this.reviewSubmitting(),
      [orderId]: true
    });

    this.reviewService.createReview({
      orderId,
      rating,
      reviewText
    }).subscribe({
      next: (review) => {
        this.reviewMap.set({
          ...this.reviewMap(),
          [orderId]: review
        });

        this.reviewRating.set({
          ...this.reviewRating(),
          [orderId]: review.rating
        });

        this.reviewText.set({
          ...this.reviewText(),
          [orderId]: review.reviewText || ''
        });

        this.reviewSubmitting.set({
          ...this.reviewSubmitting(),
          [orderId]: false
        });

        alert('Review submitted successfully.');
      },
      error: (err) => {
        this.reviewSubmitting.set({
          ...this.reviewSubmitting(),
          [orderId]: false
        });

        const message = err?.error?.message || 'Could not submit review. Please try again.';
        alert(message);
      }
    });
  }

  trackByOrderId(index: number, order: OrderSummaryResponse) {
    return order.id;
  }
}