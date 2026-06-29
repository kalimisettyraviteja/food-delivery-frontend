import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OrderService,
  OrderStatus,
  OrderSummaryResponse
} from '../../../core/services/order';

type SortOption = 'LATEST' | 'OLDEST';
type ToastType = 'success' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class AdminOrders implements OnInit {
  private orderService = inject(OrderService);

  orders: OrderSummaryResponse[] = [];
  filteredOrders: OrderSummaryResponse[] = [];

  loading = false;
  searchTerm = '';
  sortBy: SortOption = 'LATEST';
  showScrollTop = false;

  readonly skeletonRows = Array.from({ length: 6 });
  readonly statusOptions: OrderStatus[] = [
    'PLACED',
    'CONFIRMED',
    'PREPARING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ];

  selectedStatuses: Record<number, OrderStatus> = {};
  updatingOrderId: number | null = null;

  toasts: ToastMessage[] = [];
  private toastSeed = 0;

  ngOnInit(): void {
    this.loadOrders();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showScrollTop = window.scrollY > 280;
  }

  loadOrders(): void {
    this.loading = true;

    this.orderService.getAllOrders().subscribe({
      next: (response) => {
        this.orders = [...response];
        this.selectedStatuses = {};

        this.orders.forEach(order => {
          this.selectedStatuses[order.id] = order.status;
        });

        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load admin orders', error);
        this.loading = false;
        this.showToast('Failed to load orders.', 'error');
      }
    });
  }

  updateStatus(order: OrderSummaryResponse): void {
    const selectedStatus = this.selectedStatuses[order.id];

    if (!selectedStatus || selectedStatus === order.status) {
      return;
    }

    this.updatingOrderId = order.id;

    this.orderService.updateOrderStatus(order.id, { status: selectedStatus }).subscribe({
      next: (updatedOrder) => {
        this.orders = this.orders.map(existingOrder =>
          existingOrder.id === order.id
            ? { ...existingOrder, status: updatedOrder.status }
            : existingOrder
        );

        this.selectedStatuses[order.id] = updatedOrder.status;
        this.applyFilters();
        this.updatingOrderId = null;

        this.showToast(
          `Order #${order.id} updated to ${this.formatStatus(updatedOrder.status)}.`,
          'success'
        );
      },
      error: (error) => {
        console.error('Failed to update order status', error);
        this.updatingOrderId = null;
        this.selectedStatuses[order.id] = order.status;
        this.showToast(`Failed to update status for order #${order.id}.`, 'error');
      }
    });
  }

  applyFilters(): void {
    const trimmedSearch = this.searchTerm.trim();
    let result = [...this.orders];

    if (trimmedSearch) {
      result = result.filter(order => order.id.toString().includes(trimmedSearch));
    }

    result.sort((a, b) => {
      const first = new Date(a.createdAt).getTime();
      const second = new Date(b.createdAt).getTime();
      return this.sortBy === 'LATEST' ? second - first : first - second;
    });

    this.filteredOrders = result;
  }

  toggleCreatedAtSort(): void {
    this.sortBy = this.sortBy === 'LATEST' ? 'OLDEST' : 'LATEST';
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  showToast(message: string, type: ToastType): void {
    const toast: ToastMessage = {
      id: ++this.toastSeed,
      message,
      type
    };

    this.toasts = [...this.toasts, toast];

    setTimeout(() => {
      this.removeToast(toast.id);
    }, 3000);
  }

  removeToast(toastId: number): void {
    this.toasts = this.toasts.filter(toast => toast.id !== toastId);
  }

  trackByOrderId(index: number, order: OrderSummaryResponse): number {
    return order.id;
  }

  trackByToastId(index: number, toast: ToastMessage): number {
    return toast.id;
  }

  formatStatus(status: OrderStatus): string {
    return status.replace(/_/g, ' ');
  }

  formatPaymentMethod(method: string): string {
    return method.replace(/_/g, ' ');
  }

  getStatusClass(status: OrderStatus): string {
    switch (status) {
      case 'PLACED':
        return 'status-badge placed';
      case 'CONFIRMED':
        return 'status-badge confirmed';
      case 'PREPARING':
        return 'status-badge preparing';
      case 'OUT_FOR_DELIVERY':
        return 'status-badge out-for-delivery';
      case 'DELIVERED':
        return 'status-badge delivered';
      case 'CANCELLED':
        return 'status-badge cancelled';
      default:
        return 'status-badge';
    }
  }
}