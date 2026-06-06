import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CartService } from '../../core/services/cart';
import {
  ApplyCouponResponse,
  Coupon,
  CouponService
} from '../../core/services/coupon';
import {
  OrderService,
  PaymentMethod,
  PlaceOrderRequest
} from '../../core/services/order';

type UiCoupon = Coupon & {
  eligible: boolean;
  amountNeeded: number;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  private router = inject(Router);
  private couponService = inject(CouponService);
  private orderService = inject(OrderService);

  cartService = inject(CartService);

  couponCode = signal('');
  couponMessage = signal('');
  selectedPaymentMethod = signal<PaymentMethod>('CASH_ON_DELIVERY');
  placingOrder = signal(false);
  loadingCoupons = signal(false);

  globalCoupons = signal<Coupon[]>([]);
  restaurantCoupons = signal<Coupon[]>([]);
  appliedCoupon = signal<Coupon | null>(null);
  discountAmount = signal(0);

  subtotal = computed(() => this.cartService.cartTotal());
  deliveryCharge = computed(() => this.cartService.cart().length > 0 ? 40 : 0);

  finalTotal = computed(() =>
    Math.max(0, this.subtotal() - this.discountAmount() + this.deliveryCharge())
  );

  globalCouponsUi = computed<UiCoupon[]>(() =>
    this.globalCoupons().map(c => ({
      ...c,
      eligible: this.subtotal() >= c.minOrderAmount,
      amountNeeded: Math.max(0, c.minOrderAmount - this.subtotal())
    }))
  );

  restaurantCouponsUi = computed<UiCoupon[]>(() =>
    this.restaurantCoupons().map(c => ({
      ...c,
      eligible: this.subtotal() >= c.minOrderAmount,
      amountNeeded: Math.max(0, c.minOrderAmount - this.subtotal())
    }))
  );

  constructor() {
    this.loadCoupons();
  }

  loadCoupons() {
    const restaurantId = this.cartService.restaurantId();
    if (!restaurantId) return;

    this.loadingCoupons.set(true);

    forkJoin({
      global: this.couponService.getGlobalCoupons(),
      restaurant: this.couponService.getRestaurantCoupons(restaurantId)
    }).subscribe({
      next: ({ global, restaurant }) => {
        this.globalCoupons.set(global || []);
        this.restaurantCoupons.set(
          (restaurant || []).filter(c => c.scope === 'RESTAURANT')
        );
        this.loadingCoupons.set(false);
      },
      error: () => {
        this.loadingCoupons.set(false);
        this.couponMessage.set('Unable to load coupons right now');
      }
    });
  }

  applyCoupon() {
    const couponCode = this.couponCode().trim().toUpperCase();
    const restaurantId = this.cartService.restaurantId();

    if (!couponCode) {
      this.couponMessage.set('Enter coupon code');
      return;
    }

    if (!restaurantId) {
      this.couponMessage.set('Restaurant not found');
      return;
    }

    this.couponService.applyCoupon({
      couponCode,
      restaurantId,
      orderAmount: this.subtotal()
    }).subscribe({
      next: (res: ApplyCouponResponse) => {
        this.discountAmount.set(res.discountAmount || 0);
        this.couponMessage.set(res.message || 'Coupon applied successfully');

        const allCoupons = [...this.globalCoupons(), ...this.restaurantCoupons()];
        const found = allCoupons.find(c => c.code === couponCode) || null;
        this.appliedCoupon.set(found);
      },
      error: (err) => {
        this.discountAmount.set(0);
        this.appliedCoupon.set(null);
        this.couponMessage.set(
          err?.error?.message || 'Coupon is invalid or not applicable'
        );
      }
    });
  }

  applySuggestedCoupon(coupon: Coupon) {
    this.couponCode.set(coupon.code);
    this.applyCoupon();
  }

  removeCoupon() {
    this.couponCode.set('');
    this.couponMessage.set('');
    this.appliedCoupon.set(null);
    this.discountAmount.set(0);
  }

  addMoreItems() {
    const restaurantId = this.cartService.restaurantId();
    if (!restaurantId) return;
    this.router.navigate(['/restaurant', restaurantId]);
  }

  getCouponBenefitText(coupon: Coupon): string {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}% off`;
    }
    if (coupon.discountType === 'FREE_DELIVERY') {
      return `Free delivery`;
    }
    return `₹${coupon.discountValue} off`;
  }


  getPaymentLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH_ON_DELIVERY: 'Cash on Delivery',
    PHONEPE: 'PhonePe',
    GPAY: 'Google Pay',
    PAYTM: 'Paytm',
    CARD: 'Card',
    UPI: 'UPI'
  };
  return labels[method] || method;
}

  placeOrder() {
    const restaurantId = this.cartService.restaurantId();
    const restaurantName = this.cartService.restaurantName();

    if (this.cartService.cart().length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!restaurantId || !restaurantName) {
      alert('Restaurant not found');
      return;
    }

    const payload: PlaceOrderRequest = {
      restaurantId,
      restaurantName,
      couponCode: this.appliedCoupon()?.code || null,
      paymentMethod: this.selectedPaymentMethod(),
      items: this.cartService.cart().map(c => ({
        menuItemId: c.item.id!,
        itemName: c.item.name,
        price: c.item.price,
        quantity: c.qty
      }))
    };

    this.placingOrder.set(true);

    this.orderService.placeOrder(payload).subscribe({
      next: () => {
        alert(
          this.selectedPaymentMethod() === 'CASH_ON_DELIVERY'
            ? 'Order placed successfully'
            : 'Payment successful and order placed'
        );
        this.cartService.clearCart();
        this.removeCoupon();
        this.placingOrder.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.placingOrder.set(false);
        alert(err?.error?.message || 'Failed to place order');
      }
    });
  }
}