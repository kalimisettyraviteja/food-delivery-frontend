import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  OrderItemResponse,
  OrderResponse,
  OrderService
} from '../../../core/services/order';

@Component({
  selector: 'app-manager-order-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-order-detail.html',
  styleUrl: './manager-order-detail.css'
})
export class ManagerOrderDetail implements OnInit {
  order: OrderResponse | null = null;
  loading = true;
  error = '';

  constructor(
    private readonly orderService: OrderService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const orderIdParam = this.route.snapshot.paramMap.get('orderId');

    if (!orderIdParam) {
      this.error = 'Order ID is missing.';
      this.loading = false;
      return;
    }

    const orderId = Number(orderIdParam);

    if (Number.isNaN(orderId) || orderId <= 0) {
      this.error = 'Invalid order ID.';
      this.loading = false;
      return;
    }

    this.loadOrder(orderId);
  }

  loadOrder(orderId: number): void {
    this.loading = true;
    this.error = '';

    this.orderService.getManagerOrderById(orderId).subscribe({
      next: (response) => {
        this.order = response;
        this.loading = false;
      },

      error: (error) => {
        console.error('Failed to load manager order details', error);

        if (error.status === 403) {
          this.error = 'You do not have permission to view this order.';
        } else if (error.status === 404) {
          this.error = 'Order not found or you do not have access to it.';
        } else {
          this.error = 'Failed to load order details.';
        }

        this.loading = false;
      }
    });
  }

  formatStatus(status: string | null | undefined): string {
    if (!status) {
      return '-';
    }

    return status
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  statusBadgeClass(status: string | null | undefined): string {
    switch (status) {
      case 'PLACED':
        return 'text-bg-secondary';

      case 'CONFIRMED':
        return 'text-bg-info';

      case 'PREPARING':
        return 'text-bg-warning';

      case 'PICKED_UP':
      case 'OUT_FOR_DELIVERY':
        return 'text-bg-primary';

      case 'DELIVERED':
        return 'text-bg-success';

      case 'CANCELLED':
        return 'text-bg-danger';

      default:
        return 'text-bg-secondary';
    }
  }

  formatAmount(amount: number | null | undefined): string {
    if (amount == null) {
      return '0.00';
    }

    return Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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

  formatTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  itemTotal(item: OrderItemResponse): number {
    if (item.subtotal != null) {
      return item.subtotal;
    }

    return item.price * item.quantity;
  }

  goBack(): void {
    this.router.navigate(['/restaurant-manager/orders']);
  }
}