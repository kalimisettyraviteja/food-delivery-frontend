import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CartService } from '../../../core/services/cart';
import {
  ApplyCouponResponse,
  Coupon,
  CouponService
} from '../../../core/services/coupon';
import {
  OrderService,
  PaymentMethod,
  PlaceOrderRequest
} from '../../../core/services/order';

type UiCoupon = Coupon & {
  eligible: boolean;
  amountNeeded: number;
};

declare const bootstrap: any;

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

  private couponRecalcTimer: any = null;
  private isRevalidatingCoupon = false;

  subtotal = computed(() => this.cartService.cartTotal());
  deliveryCharge = computed(() => this.cartService.cart().length > 0 ? 40 : 0);

  finalTotal = computed(() =>
    Math.max(0, this.subtotal() - this.discountAmount() + this.deliveryCharge())
  );

  globalCouponsUi = computed<UiCoupon[]>(() =>
    this.globalCoupons()
      .filter(c => c.scope === 'GLOBAL')
      .map(c => ({
        ...c,
        eligible: this.subtotal() >= c.minOrderAmount,
        amountNeeded: Math.max(0, c.minOrderAmount - this.subtotal())
      }))
  );

  restaurantCouponsUi = computed<UiCoupon[]>(() =>
    this.restaurantCoupons()
      .filter(c => c.scope === 'RESTAURANT')
      .map(c => ({
        ...c,
        eligible: this.subtotal() >= c.minOrderAmount,
        amountNeeded: Math.max(0, c.minOrderAmount - this.subtotal())
      }))
  );

  constructor() {
    this.loadCoupons();

    effect(() => {
      const coupon = this.appliedCoupon();
      const subtotal = this.subtotal();

      if (!coupon) return;

      if (subtotal < coupon.minOrderAmount) {
        this.clearCouponBecauseInvalid(coupon);
        return;
      }

      this.scheduleCouponRevalidation(coupon.code);
    });
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
        this.restaurantCoupons.set(restaurant || []);
        this.loadingCoupons.set(false);
      },
      error: () => {
        this.loadingCoupons.set(false);
        this.couponMessage.set('Unable to load coupons right now');
      }
    });
  }

  applyCoupon() {
    const code = this.couponCode().trim().toUpperCase();

    if (!code) {
      this.couponMessage.set('Enter coupon code');
      return;
    }

    this.validateCouponWithBackend(code, true);
  }

  applySuggestedCoupon(coupon: Coupon) {
    this.couponCode.set(coupon.code);
    this.validateCouponWithBackend(coupon.code, true);
  }

  private findCouponByCode(code: string): Coupon | null {
  const allCoupons = [...this.globalCoupons(), ...this.restaurantCoupons()];
  return allCoupons.find(c => c.code.toUpperCase() === code.toUpperCase()) || null;
}

  validateCouponWithBackend(code: string, showSuccessMessage = true) {
  const restaurantId = this.cartService.restaurantId();

  if (!restaurantId) {
    this.couponMessage.set('Restaurant not found for this cart');
    return;
  }

  this.couponService.applyCoupon({
    couponCode: code,
    restaurantId,
    orderAmount: this.subtotal()
  }).subscribe({
    next: (res: ApplyCouponResponse) => {
      this.discountAmount.set(res.discountAmount || 0);

      const allCoupons = [...this.globalCoupons(), ...this.restaurantCoupons()];
      const found = allCoupons.find(c => c.code.toUpperCase() === code.toUpperCase()) || null;
      this.appliedCoupon.set(found);

      if (showSuccessMessage) {
        this.couponMessage.set(res.message || 'Coupon applied successfully');
      } else {
        this.couponMessage.set(`Discount updated for coupon ${code}.`);
      }

      const modalEl = document.getElementById('offersModal');
      if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance?.hide();
      }
    },
    error: (err) => {
      const existingCoupon = this.findCouponByCode(code);
      
      if (existingCoupon) {
        const minOrderAmount = existingCoupon.minOrderAmount || 0;
        const amountNeeded = Math.max(0, minOrderAmount - this.subtotal());

        this.discountAmount.set(0);
        this.appliedCoupon.set(null);

        if (amountNeeded > 0) {
          this.couponMessage.set(
            `Add ₹${amountNeeded} more to apply coupon ${existingCoupon.code}. Minimum order value is ₹${minOrderAmount}.`
          );
        } else {
          this.couponMessage.set(
            err?.error?.message || `Coupon ${existingCoupon.code} is not applicable for this cart.`
          );
        }
      } else {
        this.discountAmount.set(0);
        this.appliedCoupon.set(null);
        this.couponMessage.set(
          err?.error?.message || 'Invalid coupon code'
        );
      }
    }
  });
}

  scheduleCouponRevalidation(code: string) {
    if (this.isRevalidatingCoupon) return;

    if (this.couponRecalcTimer) {
      clearTimeout(this.couponRecalcTimer);
    }

    this.couponRecalcTimer = setTimeout(() => {
      this.revalidateAppliedCoupon(code);
    }, 300);
  }

  revalidateAppliedCoupon(code: string) {
    const restaurantId = this.cartService.restaurantId();
    if (!restaurantId || !this.appliedCoupon()) return;

    this.isRevalidatingCoupon = true;

    this.couponService.applyCoupon({
      couponCode: code,
      restaurantId,
      orderAmount: this.subtotal()
    }).subscribe({
      next: (res: ApplyCouponResponse) => {
        this.discountAmount.set(res.discountAmount || 0);
        this.isRevalidatingCoupon = false;
      },
      error: () => {
        const currentCoupon = this.appliedCoupon();
        if (currentCoupon) {
          this.clearCouponBecauseInvalid(currentCoupon);
        }
        this.isRevalidatingCoupon = false;
      }
    });
  }

  clearCouponBecauseInvalid(coupon: Coupon) {
    this.discountAmount.set(0);
    this.appliedCoupon.set(null);
    this.couponCode.set('');
    this.couponMessage.set(
      `Coupon ${coupon.code} removed. Minimum order value ₹${coupon.minOrderAmount} is no longer met.`
    );
  }

  removeCoupon() {
    this.couponCode.set('');
    this.couponMessage.set('');
    this.appliedCoupon.set(null);
    this.discountAmount.set(0);

    if (this.couponRecalcTimer) {
      clearTimeout(this.couponRecalcTimer);
      this.couponRecalcTimer = null;
    }
  }

  addMoreItems() {
    const restaurantId = this.cartService.restaurantId();
    if (!restaurantId) return;
    this.router.navigate(['/home/restaurant', restaurantId]);
  }

  getCouponBenefitText(coupon: Coupon): string {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}% off`;
    }
    return `₹${coupon.discountValue} off`;
  }

  getPaymentLabel(method: PaymentMethod): string {
    switch (method) {
      case 'PHONEPE':
        return 'PhonePe';
      case 'GPAY':
        return 'Google Pay';
      case 'PAYTM':
        return 'Paytm';
      default:
        return 'Cash on Delivery';
    }
  }

  placeOrder() {
    const restaurantId = this.cartService.restaurantId();

    if (this.cartService.cart().length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!restaurantId) {
      alert('Restaurant not found');
      return;
    }

    const coupon = this.appliedCoupon();
    if (coupon && this.subtotal() < coupon.minOrderAmount) {
      this.clearCouponBecauseInvalid(coupon);
      alert(`Coupon ${coupon.code} is no longer valid for the updated cart total.`);
      return;
    }

    this.placingOrder.set(true);

    const payload: PlaceOrderRequest = {
      restaurantId,
      restaurantName: this.cartService.restaurantName(),
      items: this.cartService.cart().map(c => ({
        menuItemId: c.item.id!,
        itemName: c.item.name,
        price: c.item.price,
        quantity: c.qty
      })),
      couponCode: this.appliedCoupon()?.code || null,
      paymentMethod: this.selectedPaymentMethod()
    };

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