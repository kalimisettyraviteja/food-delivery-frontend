import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  OrderResponse,
  OrderService,
  OrderStatus,
  UpdateOrderStatusRequest
} from '../../../core/services/order';

type DateFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS';

@Component({
  selector: 'app-manager-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manager-orders.html',
  styleUrl: './manager-orders.css'
})
export class ManagerOrders implements OnInit {
  orders: OrderResponse[] = [];

  loading = true;
  error = '';
  exporting = false;

  statusFilter: OrderStatus | 'ALL' = 'ALL';
  dateFilter: DateFilter = 'ALL';

  /**
   * Searches by numeric order ID.
   * Partial searches are supported:
   * "12" matches orders such as #12, #120, and #1234.
   */
  orderIdSearch = '';

  updatingOrderId: number | null = null;

  showStatusConfirmModal = false;
  selectedOrder: OrderResponse | null = null;
  selectedNewStatus: OrderStatus | null = null;

  readonly statuses: OrderStatus[] = [
    'PLACED',
    'CONFIRMED',
    'PREPARING',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ];

  constructor(
    private readonly orderService: OrderService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = '';

    this.orderService.getManagerOrders().subscribe({
      next: response => {
        this.orders = response ?? [];
        this.loading = false;
      },

      error: error => {
        console.error('Failed to load manager orders', error);

        if (error.status === 401) {
          this.error = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          this.error =
            'You do not have permission to view manager orders.';
        } else {
          this.error = 'Failed to load orders. Please try again.';
        }

        this.loading = false;
      }
    });
  }

  get filteredOrders(): OrderResponse[] {
    const normalizedOrderIdSearch = this.normalizeOrderIdSearch(
      this.orderIdSearch
    );

    return this.orders.filter(order => {
      const matchesOrderId =
        !normalizedOrderIdSearch ||
        String(order.id).includes(normalizedOrderIdSearch);

      const matchesStatus =
        this.statusFilter === 'ALL' ||
        order.status === this.statusFilter;

      const matchesDate = this.matchesDateFilter(order.createdAt);

      return matchesOrderId && matchesStatus && matchesDate;
    });
  }

  get hasActiveFilters(): boolean {
    return (
      this.orderIdSearch.trim().length > 0 ||
      this.statusFilter !== 'ALL' ||
      this.dateFilter !== 'ALL'
    );
  }

  get totalOrders(): number {
    return this.filteredOrders.length;
  }

  get activeOrders(): number {
    return this.filteredOrders.filter(
      order => !this.isTerminalStatus(order.status)
    ).length;
  }

  get deliveredOrders(): number {
    return this.filteredOrders.filter(
      order => order.status === 'DELIVERED'
    ).length;
  }

  get totalRevenue(): number {
    return this.filteredOrders
      .filter(order => order.status !== 'CANCELLED')
      .reduce(
        (total, order) => total + (order.totalAmount ?? 0),
        0
      );
  }

  get filteredOrderLabel(): string {
    const labels: string[] = [];

    if (this.dateFilter === 'TODAY') {
      labels.push('Today');
    } else if (this.dateFilter === 'LAST_7_DAYS') {
      labels.push('Last 7 days');
    } else {
      labels.push('All time');
    }

    if (this.statusFilter !== 'ALL') {
      labels.push(this.formatStatus(this.statusFilter));
    }

    if (this.orderIdSearch.trim()) {
      labels.push(`Order #${this.orderIdSearch.trim()}`);
    }

    return labels.join(' · ');
  }

  normalizeOrderIdSearch(value: string): string {
    return value.replace(/\D/g, '').trim();
  }

  clearOrderIdSearch(): void {
    this.orderIdSearch = '';
  }

  onStatusSelection(
    order: OrderResponse,
    selectedStatus: string
  ): void {
    const newStatus = selectedStatus as OrderStatus;

    if (!newStatus || newStatus === order.status) {
      return;
    }

    this.selectedOrder = order;
    this.selectedNewStatus = newStatus;
    this.showStatusConfirmModal = true;
  }

  closeStatusConfirmModal(): void {
    if (this.updatingOrderId !== null) {
      return;
    }

    this.showStatusConfirmModal = false;
    this.selectedOrder = null;
    this.selectedNewStatus = null;
  }

  confirmStatusUpdate(): void {
    if (!this.selectedOrder || !this.selectedNewStatus) {
      return;
    }

    const orderId = this.selectedOrder.id;
    const newStatus = this.selectedNewStatus;

    this.updatingOrderId = orderId;

    const payload: UpdateOrderStatusRequest = {
      status: newStatus
    };

    this.orderService
      .updateManagerOrderStatus(orderId, payload)
      .subscribe({
        next: updatedOrder => {
          const index = this.orders.findIndex(
            order => order.id === orderId
          );

          if (index !== -1) {
            this.orders[index] = updatedOrder;
            this.orders = [...this.orders];
          }

          this.updatingOrderId = null;
          this.closeStatusConfirmModal();
        },

        error: error => {
          console.error(
            'Failed to update manager order status',
            error
          );

          this.updatingOrderId = null;
          this.closeStatusConfirmModal();

          if (error.status === 403) {
            window.alert(
              'You do not have permission to update this order.'
            );
            return;
          }

          if (error.status === 404) {
            window.alert(
              'Order not found or you no longer have access to it.'
            );
            return;
          }

          window.alert(
            'Failed to update the order status. Please try again.'
          );
        }
      });
  }

  matchesDateFilter(createdAt: string): boolean {
    if (this.dateFilter === 'ALL') {
      return true;
    }

    if (!createdAt) {
      return false;
    }

    const orderDate = new Date(createdAt);

    if (Number.isNaN(orderDate.getTime())) {
      return false;
    }

    const now = new Date();

    if (this.dateFilter === 'TODAY') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getDate() === now.getDate()
      );
    }

    if (this.dateFilter === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date();

      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      return orderDate >= sevenDaysAgo && orderDate <= now;
    }

    return true;
  }

  exportCsv(): void {
    const ordersToExport = this.filteredOrders;

    if (ordersToExport.length === 0) {
      window.alert(
        'There are no orders matching the selected filters.'
      );
      return;
    }

    this.exporting = true;

    try {
      const header = [
        'Order ID',
        'Restaurant ID',
        'Restaurant Name',
        'Customer Email',
        'Status',
        'Payment Method',
        'Payment Status',
        'Original Amount',
        'Discount Amount',
        'Delivery Charge',
        'Total Amount',
        'Coupon Code',
        'Placed At',
        'Estimated Delivery At',
        'Items'
      ];

      const rows = ordersToExport.map(order => [
        order.id,
        order.restaurantId,
        order.restaurantName,
        order.userEmail,
        this.formatStatus(order.status),
        this.formatStatus(order.paymentMethod),
        this.formatStatus(order.paymentStatus),
        order.originalAmount ?? 0,
        order.discountAmount ?? 0,
        order.deliveryCharge ?? 0,
        order.totalAmount ?? 0,
        order.couponCode ?? '',
        this.formatDateTime(order.createdAt),
        this.formatDateTime(order.estimatedDeliveryAt),
        this.getItemsText(order)
      ]);

      const csv = [
        header.map(value => this.escapeCsvValue(value)).join(','),
        ...rows.map(row =>
          row.map(value => this.escapeCsvValue(value)).join(',')
        )
      ].join('\n');

      const blob = new Blob(
        ['\uFEFF' + csv],
        { type: 'text/csv;charset=utf-8;' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `manager-orders-${this.getFileDate()}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } finally {
      this.exporting = false;
    }
  }

  getItemsText(order: OrderResponse): string {
    if (!order.items || order.items.length === 0) {
      return '';
    }

    return order.items
      .map(item => `${item.itemName} x${item.quantity}`)
      .join(' | ');
  }

  escapeCsvValue(value: unknown): string {
    const stringValue = String(value ?? '');

    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  getFileDate(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  clearFilters(): void {
    this.orderIdSearch = '';
    this.statusFilter = 'ALL';
    this.dateFilter = 'ALL';
  }

  isTerminalStatus(status: OrderStatus): boolean {
    return status === 'DELIVERED' || status === 'CANCELLED';
  }

  statusBadgeClass(status: OrderStatus | string): string {
    switch (status) {
      case 'PLACED':
        return 'status-placed';

      case 'CONFIRMED':
        return 'status-confirmed';

      case 'PREPARING':
        return 'status-preparing';

      case 'PICKED_UP':
        return 'status-picked-up';

      case 'OUT_FOR_DELIVERY':
        return 'status-out-for-delivery';

      case 'DELIVERED':
        return 'status-delivered';

      case 'CANCELLED':
        return 'status-cancelled';

      default:
        return 'status-placed';
    }
  }

  formatStatus(status: string | null | undefined): string {
    if (!status) {
      return '-';
    }

    return status
      .toLowerCase()
      .split('_')
      .map(
        word => word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(' ');
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

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  formatTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  viewOrder(orderId: number): void {
    this.router.navigate([
      '/restaurant-manager/orders',
      orderId
    ]);
  }

  trackByOrderId(
    _index: number,
    order: OrderResponse
  ): number {
    return order.id;
  }
}