import {
  CommonModule,
  DatePipe
} from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  forkJoin,
  of
} from 'rxjs';
import {
  catchError,
  finalize,
  switchMap
} from 'rxjs/operators';
import {
  OrderDeliveryAddressResponse,
  OrderResponse,
  OrderService,
  OrderStatus,
  OrderSummaryResponse
} from '../../../core/services/order';
import {
  ReviewResponse,
  ReviewService
} from '../../../core/services/review';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe
  ],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly reviewService = inject(ReviewService);

  loading = signal(true);
  detailsLoadingId = signal<number | null>(null);

  orders = signal<OrderSummaryResponse[]>([]);
  orderDetailsMap = signal<Record<number, OrderResponse>>({});

  selectedOrderId = signal<number | null>(null);
  orderSearchTerm = signal('');

  reviewModalOrderId = signal<number | null>(null);
  reviewModalReadOnly = signal(false);

  reviewRating = signal<Record<number, number>>({});
  reviewText = signal<Record<number, string>>({});
  reviewSubmitting = signal<Record<number, boolean>>({});
  reviewMap = signal<Record<number, ReviewResponse>>({});
  reviewLoadingMap = signal<Record<number, boolean>>({});

  filteredOrders = computed(() => {
    const search = this.orderSearchTerm()
      .trim()
      .toLowerCase();

    const list = this.orders();

    if (!search) {
      return list;
    }

    return list.filter(order => {
      const detail = this.orderDetailsMap()[order.id];

      const summaryText = [
        order.restaurantName,
        this.getRestaurantLocation(order),
        String(order.id),
        order.status,
        order.paymentMethod
      ]
        .join(' ')
        .toLowerCase();

      const itemText = detail?.items
        ?.map(item => item.itemName)
        .join(' ')
        .toLowerCase() ?? '';

      return (
        summaryText.includes(search) ||
        itemText.includes(search)
      );
    });
  });

  selectedOrderSummary = computed(() => {
    const selectedId = this.selectedOrderId();

    if (selectedId === null) {
      return null;
    }

    return this.orders().find(
      order => order.id === selectedId
    ) ?? null;
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);

    this.orderService
      .getMyOrders()
      .pipe(
        switchMap(orders => {
          const orderList = orders ?? [];

          this.orders.set(orderList);

          if (!orderList.length) {
            return of([] as OrderResponse[]);
          }

          return forkJoin(
            orderList.map(order =>
              this.orderService
                .getOrderById(order.id)
                .pipe(
                  catchError(() => of(null))
                )
            )
          );
        }),

        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: details => {
          const detailMap: Record<number, OrderResponse> = {};

          details.forEach(detail => {
            if (detail) {
              detailMap[detail.id] = detail;
            }
          });

          this.orderDetailsMap.set(detailMap);

          const deliveredOrderIds = Object.values(detailMap)
            .filter(order => order.status === 'DELIVERED')
            .map(order => order.id);

          this.loadReviewsForDeliveredOrders(
            deliveredOrderIds
          );
        },

        error: () => {
          this.orders.set([]);
          this.orderDetailsMap.set({});
        }
      });
  }

  private loadReviewsForDeliveredOrders(
    orderIds: number[]
  ): void {
    if (!orderIds.length) {
      return;
    }

    const loadingMap = orderIds.reduce(
      (result, orderId) => {
        result[orderId] = true;
        return result;
      },
      {} as Record<number, boolean>
    );

    this.reviewLoadingMap.set({
      ...this.reviewLoadingMap(),
      ...loadingMap
    });

    forkJoin(
      orderIds.map(orderId =>
        this.reviewService
          .getReviewByOrderId(orderId)
          .pipe(
            catchError(() => of(null))
          )
      )
    ).subscribe({
      next: reviews => {
        const reviewMap = {
          ...this.reviewMap()
        };

        const ratingMap = {
          ...this.reviewRating()
        };

        const textMap = {
          ...this.reviewText()
        };

        const updatedLoadingMap = {
          ...this.reviewLoadingMap()
        };

        reviews.forEach((review, index) => {
          const orderId = orderIds[index];

          if (review) {
            reviewMap[orderId] = review;
            ratingMap[orderId] = review.rating;
            textMap[orderId] = review.reviewText || '';
          }

          updatedLoadingMap[orderId] = false;
        });

        this.reviewMap.set(reviewMap);
        this.reviewRating.set(ratingMap);
        this.reviewText.set(textMap);
        this.reviewLoadingMap.set(updatedLoadingMap);
      },

      error: () => {
        const updatedLoadingMap = {
          ...this.reviewLoadingMap()
        };

        orderIds.forEach(orderId => {
          updatedLoadingMap[orderId] = false;
        });

        this.reviewLoadingMap.set(updatedLoadingMap);
      }
    });
  }

  updateOrderSearch(value: string): void {
    this.orderSearchTerm.set(value);
  }

  openOrderModal(orderId: number): void {
    this.selectedOrderId.set(orderId);

    const cachedDetail =
      this.orderDetailsMap()[orderId];

    if (cachedDetail) {
      this.loadReviewIfNeeded(orderId);
      return;
    }

    this.detailsLoadingId.set(orderId);

    this.orderService
      .getOrderById(orderId)
      .pipe(
        finalize(() => {
          this.detailsLoadingId.set(null);
        })
      )
      .subscribe({
        next: detail => {
          this.orderDetailsMap.set({
            ...this.orderDetailsMap(),
            [orderId]: detail
          });

          this.loadReviewIfNeeded(orderId);
        }
      });
  }

  closeOrderModal(): void {
    this.selectedOrderId.set(null);
  }

  openReviewModal(orderId: number): void {
    const detail = this.orderDetailsMap()[orderId];

    if (detail?.status !== 'DELIVERED') {
      return;
    }

    this.loadReviewIfNeeded(orderId);

    this.reviewModalOrderId.set(orderId);
    this.reviewModalReadOnly.set(
      this.hasReview(orderId)
    );
  }

  closeReviewModal(): void {
    if (this.reviewModalOrderId() !== null) {
      const orderId = this.reviewModalOrderId() as number;

      if (!this.hasReview(orderId)) {
        this.reviewRating.set({
          ...this.reviewRating(),
          [orderId]: 0
        });

        this.reviewText.set({
          ...this.reviewText(),
          [orderId]: ''
        });
      }
    }

    this.reviewModalOrderId.set(null);
    this.reviewModalReadOnly.set(false);
  }

  getReviewModalRestaurantName(): string {
    const orderId = this.reviewModalOrderId();

    if (orderId === null) {
      return 'Order review';
    }

    const detail = this.orderDetailsMap()[orderId];

    if (detail?.restaurantName) {
      return detail.restaurantName;
    }

    return this.orders().find(
      order => order.id === orderId
    )?.restaurantName || 'Order review';
  }

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 1:
        return 'Very disappointed';

      case 2:
        return 'Could be better';

      case 3:
        return 'It was okay';

      case 4:
        return 'Really good';

      case 5:
        return 'Loved it!';

      default:
        return '';
    }
  }

  getOrderDetails(
    orderId: number
  ): OrderResponse | null {
    return this.orderDetailsMap()[orderId] ?? null;
  }

  getOrderPreview(
    order: OrderSummaryResponse
  ): string {
    const detail = this.orderDetailsMap()[order.id];

    if (!detail?.items?.length) {
      return 'Order items unavailable';
    }

    const firstItem = detail.items[0];
    const remainingItems = detail.items.length - 1;

    const firstItemText =
      `${firstItem.quantity} × ${firstItem.itemName}`;

    return remainingItems > 0
      ? `${firstItemText} + ${remainingItems} more`
      : firstItemText;
  }

  getRestaurantLocation(
    order: OrderSummaryResponse
  ): string {
    const typedOrder = order as OrderSummaryResponse & {
      restaurantLocation?: string | null;
      location?: string | null;
      restaurantAddress?: string | null;
    };

    return (
      typedOrder.restaurantLocation ??
      typedOrder.location ??
      typedOrder.restaurantAddress ??
      'Restaurant location'
    );
  }

  isVegetarianOrder(
    order: OrderSummaryResponse
  ): boolean {
    const detail = this.orderDetailsMap()[order.id];

    if (!detail?.items?.length) {
      return false;
    }

    return detail.items.every(item => {
      const typedItem = item as typeof item & {
        isPureVeg?: boolean;
        isVeg?: boolean;
      };

      return (
        typedItem.isPureVeg === true ||
        typedItem.isVeg === true
      );
    });
  }

  getReadableStatus(status: OrderStatus): string {
    return status
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  isActiveOrder(status: OrderStatus): boolean {
    return [
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'OUT_FOR_DELIVERY'
    ].includes(status);
  }

  getStatusMessage(status: OrderStatus): string {
    switch (status) {
      case 'PLACED':
        return 'Order received';

      case 'CONFIRMED':
        return 'Restaurant confirmed your order';

      case 'PREPARING':
        return 'Your food is being prepared';

      case 'OUT_FOR_DELIVERY':
        return 'Your order is on the way';

      default:
        return '';
    }
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

  loadReviewIfNeeded(orderId: number): void {
    const detail = this.orderDetailsMap()[orderId];

    if (!detail || detail.status !== 'DELIVERED') {
      return;
    }

    if (
      this.reviewMap()[orderId] ||
      this.reviewLoadingMap()[orderId]
    ) {
      return;
    }

    this.reviewLoadingMap.set({
      ...this.reviewLoadingMap(),
      [orderId]: true
    });

    this.reviewService
      .getReviewByOrderId(orderId)
      .pipe(
        finalize(() => {
          this.reviewLoadingMap.set({
            ...this.reviewLoadingMap(),
            [orderId]: false
          });
        })
      )
      .subscribe({
        next: review => {
          if (!review) {
            return;
          }

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

          if (this.reviewModalOrderId() === orderId) {
            this.reviewModalReadOnly.set(true);
          }
        }
      });
  }

  getExistingReview(
    orderId: number
  ): ReviewResponse | null {
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

  setRating(
    orderId: number,
    rating: number
  ): void {
    if (this.hasReview(orderId)) {
      return;
    }

    this.reviewRating.set({
      ...this.reviewRating(),
      [orderId]: rating
    });
  }

  updateReview(
    orderId: number,
    text: string
  ): void {
    if (this.hasReview(orderId)) {
      return;
    }

    this.reviewText.set({
      ...this.reviewText(),
      [orderId]: text
    });
  }

  submitReviewFromModal(orderId: number): void {
    this.submitReview(orderId, true);
  }

  submitReview(
    orderId: number,
    closeModalAfterSuccess = false
  ): void {
    if (this.hasReview(orderId)) {
      return;
    }

    const rating = this.reviewRating()[orderId];
    const reviewText =
      (this.reviewText()[orderId] || '').trim();

    if (!rating) {
      alert('Please select a rating first.');
      return;
    }

    this.reviewSubmitting.set({
      ...this.reviewSubmitting(),
      [orderId]: true
    });

    this.reviewService
      .createReview({
        orderId,
        rating,
        reviewText
      })
      .pipe(
        finalize(() => {
          this.reviewSubmitting.set({
            ...this.reviewSubmitting(),
            [orderId]: false
          });
        })
      )
      .subscribe({
        next: review => {
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

          this.reviewModalReadOnly.set(true);

          if (closeModalAfterSuccess) {
            setTimeout(() => {
              this.closeReviewModal();
            }, 550);
          }
        },

        error: err => {
          alert(
            err?.error?.message ||
            'Could not submit review. Please try again.'
          );
        }
      });
  }

  downloadInvoiceForOrder(
    order: OrderSummaryResponse
  ): void {
    const detail = this.orderDetailsMap()[order.id];

    if (!detail) {
      return;
    }

    this.downloadInvoice(detail);
  }

  downloadInvoice(detail: OrderResponse): void {
    if (detail.status !== 'DELIVERED') {
      alert(
        'Invoice will be available after the order is delivered.'
      );
      return;
    }

    const address = detail.deliveryAddress;

    const itemRows = detail.items
      .map(
        item => `
          <tr>
            <td>${this.escapeHtml(item.itemName)}</td>
            <td>${item.quantity}</td>
            <td>₹${item.price}</td>
            <td>₹${item.subtotal}</td>
          </tr>
        `
      )
      .join('');

    const addressText = address
      ? this.escapeHtml(this.getFullAddress(address))
      : 'Address not available';

    const invoiceWindow = window.open(
      '',
      '_blank',
      'width=850,height=800'
    );

    if (!invoiceWindow) {
      alert(
        'Please allow popups in your browser to download the invoice.'
      );
      return;
    }

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Cravyo Invoice #${detail.id}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 38px;
              color: #172033;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }

            .invoice {
              max-width: 760px;
              margin: 0 auto;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              padding-bottom: 20px;
              border-bottom: 2px solid #ff5a00;
            }

            .brand {
              color: #ff5a00;
              font-size: 28px;
              font-weight: 900;
              letter-spacing: -1px;
            }

            .subtitle {
              margin-top: 5px;
              color: #6b7280;
              font-size: 13px;
            }

            .invoice-title {
              color: #172033;
              font-size: 23px;
              font-weight: 800;
              text-align: right;
            }

            .invoice-meta {
              margin-top: 5px;
              color: #6b7280;
              font-size: 12px;
              text-align: right;
            }

            .section {
              margin-top: 25px;
            }

            .section h3 {
              margin: 0 0 10px;
              color: #172033;
              font-size: 14px;
            }

            .address {
              padding: 13px;
              border: 1px solid #eeeeee;
              border-radius: 8px;
              color: #4b5563;
              font-size: 13px;
              line-height: 1.55;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }

            th {
              padding: 11px;
              background: #fff4ed;
              color: #9a3f10;
              font-size: 11px;
              text-align: left;
              text-transform: uppercase;
            }

            td {
              padding: 11px;
              border-bottom: 1px solid #eeeeee;
            }

            th:last-child,
            td:last-child {
              text-align: right;
            }

            .summary {
              width: 320px;
              margin: 20px 0 0 auto;
              font-size: 13px;
            }

            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              color: #4b5563;
            }

            .total {
              margin-top: 6px;
              padding-top: 12px;
              border-top: 1px solid #dddddd;
              color: #172033;
              font-size: 16px;
              font-weight: 800;
            }

            .discount {
              color: #16803b;
            }

            .footer {
              margin-top: 38px;
              padding-top: 15px;
              border-top: 1px solid #eeeeee;
              color: #8a8a8a;
              font-size: 11px;
              text-align: center;
            }

            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>

        <body>
          <main class="invoice">
            <header class="header">
              <div>
                <div class="brand">Cravyo</div>
                <div class="subtitle">
                  Delicious food, delivered to your door.
                </div>
              </div>

              <div>
                <div class="invoice-title">Tax Invoice</div>
                <div class="invoice-meta">
                  Order #${detail.id}<br />
                  ${new Date(detail.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            </header>

            <section class="section">
              <h3>Restaurant</h3>
              <div class="address">
                <strong>
                  ${this.escapeHtml(detail.restaurantName)}
                </strong><br />
                Food order delivered through Cravyo
              </div>
            </section>

            <section class="section">
              <h3>Delivery address</h3>
              <div class="address">
                <strong>
                  ${this.escapeHtml(
                    address?.receiverName || 'Customer'
                  )}
                </strong><br />
                ${this.escapeHtml(address?.phoneNumber || '')}<br />
                ${addressText}
              </div>
            </section>

            <section class="section">
              <h3>Order items</h3>

              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </section>

            <section class="summary">
              <div class="summary-row">
                <span>Item total</span>
                <span>₹${detail.originalAmount}</span>
              </div>

              ${
                detail.discountAmount > 0
                  ? `
                    <div class="summary-row discount">
                      <span>Discount</span>
                      <span>- ₹${detail.discountAmount}</span>
                    </div>
                  `
                  : ''
              }

              <div class="summary-row">
                <span>Delivery charge</span>
                <span>₹${detail.deliveryCharge}</span>
              </div>

              <div class="summary-row total">
                <span>Total paid</span>
                <span>₹${detail.totalAmount}</span>
              </div>
            </section>

            <footer class="footer">
              Payment method:
              ${this.escapeHtml(
                detail.paymentMethod.replaceAll('_', ' ')
              )}
              • Payment status:
              ${this.escapeHtml(detail.paymentStatus)}<br /><br />
              Thank you for ordering with Cravyo.
            </footer>
          </main>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    invoiceWindow.document.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  trackByOrderId(
    _index: number,
    order: OrderSummaryResponse
  ): number {
    return order.id;
  }

  getAddressLabel(
    label?: string | null,
    customLabel?: string | null
  ): string {
    if (
      label === 'OTHER' &&
      customLabel?.trim()
    ) {
      return customLabel.trim();
    }

    return label?.trim() || 'Saved Address';
  }

  getFullAddress(
    address: OrderDeliveryAddressResponse
  ): string {
    return [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
      address.city,
      address.state,
      address.postalCode
    ]
      .filter(Boolean)
      .join(', ');
  }
}