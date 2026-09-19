import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart';
import {
  ApplyCouponResponse,
  Coupon,
  CouponService
} from '../../../core/services/coupon';
import {
  OrderRestaurantSnapshotRequest,
  OrderService,
  PaymentMethod,
  PlaceOrderRequest
} from '../../../core/services/order';
import {
  AddressResponse,
  UserService
} from '../../../core/services/user';

type UiCoupon = Coupon & {
  eligible: boolean;
  amountNeeded: number;
};

type ToastType = 'success' | 'error' | 'warning';

type ToastData = {
  message: string;
  type: ToastType;
};

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
};

declare const bootstrap: any;

const CONFETTI_COLORS = [
  '#f46b13',
  '#ff8b37',
  '#ffd700',
  '#ff6b6b',
  '#4ecdc4',
  '#45b7d1',
  '#95e1d3'
];

const MAX_DELIVERY_DISTANCE_KM = 15;
const CELEBRATION_DURATION_MS = 1200;
const ADDRESS_DROPDOWN_LIMIT = 3;

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout implements OnDestroy {
  private readonly router = inject(Router);
  private readonly couponService = inject(CouponService);
  private readonly orderService = inject(OrderService);
  private readonly userService = inject(UserService);

  cartService = inject(CartService);

  couponCode = signal('');
  couponMessage = signal('');
  couponMessageType = signal<'success' | 'error'>('success');

  selectedPaymentMethod =
    signal<PaymentMethod>('CASH_ON_DELIVERY');

  placingOrder = signal(false);
  loadingCoupons = signal(false);

  globalCoupons = signal<Coupon[]>([]);
  restaurantCoupons = signal<Coupon[]>([]);
  appliedCoupon = signal<Coupon | null>(null);
  discountAmount = signal(0);

  activeAddress = signal<AddressResponse | null>(null);

  straightLineDistanceKm = signal<number | null>(null);
  outOfRange = signal(false);

  /*
   * Checkout-local address drawer state.
   * It does not modify an existing order.
   */
  loadingSavedAddresses = signal(false);
  savingCheckoutAddress = signal(false);
  savedAddressList = signal<AddressResponse[]>([]);
  selectedAddressId = signal<number | null>(null);
  showAllSavedAddresses = signal(false);
  checkoutAddressError = signal('');

  toast = signal<ToastData | null>(null);
  showCelebration = signal(false);

  confettiPieces: ConfettiPiece[] = Array.from(
    { length: 60 },
    (_, index) => ({
      id: index,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.5 + Math.random() * 2,
      color: CONFETTI_COLORS[
        index % CONFETTI_COLORS.length
      ],
      size: 8 + Math.random() * 8
    })
  );

  private couponRecheckTimer: any = null;
  private isRecheckingCoupon = false;
  private toastTimer: any = null;
  private celebrationTimer: any = null;

  subtotal = computed(() => this.cartService.cartTotal());

  deliveryCharge = computed(() =>
    this.cartService.cart().length > 0
      ? 40
      : 0
  );

  finalTotal = computed(() =>
    Math.max(
      0,
      this.subtotal() -
        this.discountAmount() +
        this.deliveryCharge()
    )
  );

  globalCouponsUi = computed<UiCoupon[]>(() =>
    this.globalCoupons()
      .filter(coupon => coupon.scope === 'GLOBAL')
      .map(coupon => ({
        ...coupon,
        eligible:
          this.subtotal() >= coupon.minOrderAmount,
        amountNeeded: Math.max(
          0,
          coupon.minOrderAmount - this.subtotal()
        )
      }))
  );

  restaurantCouponsUi = computed<UiCoupon[]>(() =>
    this.restaurantCoupons()
      .filter(coupon => coupon.scope === 'RESTAURANT')
      .map(coupon => ({
        ...coupon,
        eligible:
          this.subtotal() >= coupon.minOrderAmount,
        amountNeeded: Math.max(
          0,
          coupon.minOrderAmount - this.subtotal()
        )
      }))
  );

  visibleSavedAddresses = computed(() => {
    const addresses = this.savedAddressList();

    return this.showAllSavedAddresses()
      ? addresses
      : addresses.slice(0, ADDRESS_DROPDOWN_LIMIT);
  });

  hasMoreSavedAddresses = computed(() =>
    this.savedAddressList().length >
      ADDRESS_DROPDOWN_LIMIT &&
    !this.showAllSavedAddresses()
  );

  selectedCheckoutAddress = computed(() => {
    const addressId = this.selectedAddressId();

    if (addressId === null) {
      return null;
    }

    return this.savedAddressList().find(
      address => address.id === addressId
    ) ?? null;
  });

  selectedCheckoutAddressDistanceKm = computed(() => {
    const address = this.selectedCheckoutAddress();

    if (!address) {
      return null;
    }

    return this.getDistanceToRestaurant(address);
  });

  selectedCheckoutAddressOutOfRange = computed(() => {
    const distance = this.selectedCheckoutAddressDistanceKm();

    return (
      distance !== null &&
      distance > MAX_DELIVERY_DISTANCE_KM
    );
  });

  constructor() {
    this.loadCoupons();
    this.loadSavedAddress();

    effect(() => {
      const coupon = this.appliedCoupon();
      const subtotal = this.subtotal();

      if (!coupon) {
        return;
      }

      if (subtotal < coupon.minOrderAmount) {
        this.removeInvalidCoupon(coupon);
        return;
      }

      this.scheduleCouponRecheck(coupon.code);
    });
  }

  ngOnDestroy(): void {
    if (this.couponRecheckTimer) {
      clearTimeout(this.couponRecheckTimer);
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
  }

  showToast(
    message: string,
    type: ToastType = 'error'
  ): void {
    this.toast.set({ message, type });

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toast.set(null);
    }, 3500);
  }

  private triggerCelebration(
    onComplete: () => void
  ): void {
    this.showCelebration.set(true);

    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }

    this.celebrationTimer = setTimeout(() => {
      this.showCelebration.set(false);
      onComplete();
    }, CELEBRATION_DURATION_MS);
  }

  /*
   * =================================================
   * Checkout address selection
   * =================================================
   */

  private loadSavedAddress(): void {
    const rawAddress = localStorage.getItem(
      'selectedAddress'
    );

    if (!rawAddress) {
      this.activeAddress.set(null);
      return;
    }

    try {
      const address = JSON.parse(
        rawAddress
      ) as AddressResponse;

      this.activeAddress.set(address);
      this.checkRadius(address);
    } catch {
      localStorage.removeItem('selectedAddress');
      this.activeAddress.set(null);
    }
  }

  prepareCheckoutAddressChange(): void {
    const currentAddress = this.activeAddress();

    this.selectedAddressId.set(
      currentAddress?.id ?? null
    );

    this.showAllSavedAddresses.set(false);
    this.checkoutAddressError.set('');
    this.loadCheckoutSavedAddresses();
  }

  private loadCheckoutSavedAddresses(): void {
    this.loadingSavedAddresses.set(true);
    this.checkoutAddressError.set('');

    this.userService.getSavedAddresses().subscribe({
      next: addresses => {
        const addressList = addresses ?? [];

        this.savedAddressList.set(addressList);
        this.loadingSavedAddresses.set(false);

        /*
         * When selectedAddress in localStorage has no ID,
         * choose the default saved address only for drawer UI.
         */
        if (
          this.selectedAddressId() === null &&
          !this.activeAddress()?.id
        ) {
          const defaultAddress = addressList.find(
            address => address.isDefault
          );

          if (defaultAddress?.id) {
            this.selectedAddressId.set(defaultAddress.id);
          }
        }
      },

      error: error => {
        this.savedAddressList.set([]);
        this.loadingSavedAddresses.set(false);

        this.checkoutAddressError.set(
          error?.error?.message ||
          'Unable to load saved addresses.'
        );
      }
    });
  }

  selectCheckoutAddress(
    address: AddressResponse
  ): void {
    if (!address.id) {
      this.checkoutAddressError.set(
        'This saved address cannot be selected.'
      );
      return;
    }

    this.selectedAddressId.set(address.id);
    this.checkoutAddressError.set('');
  }

  showMoreCheckoutAddresses(): void {
    this.showAllSavedAddresses.set(true);
  }

  isCheckoutAddressSelected(
    address: AddressResponse
  ): boolean {
    return this.selectedAddressId() === address.id;
  }

  confirmCheckoutAddressChange(): void {
    if (this.savingCheckoutAddress()) {
      return;
    }

    const addressId = this.selectedAddressId();

    if (addressId === null) {
      this.checkoutAddressError.set(
        'Select an address to continue.'
      );
      return;
    }

    const selectedAddress = this.savedAddressList().find(
      address => address.id === addressId
    );

    if (!selectedAddress) {
      this.checkoutAddressError.set(
        'Selected address was not found.'
      );
      return;
    }

    const distance = this.getDistanceToRestaurant(
      selectedAddress
    );

    if (
      distance !== null &&
      distance > MAX_DELIVERY_DISTANCE_KM
    ) {
      this.checkoutAddressError.set(
        `This address is ${distance.toFixed(1)} km away. ` +
        `Please select an address within ${MAX_DELIVERY_DISTANCE_KM} km.`
      );
      return;
    }

    this.savingCheckoutAddress.set(true);

    /*
     * Checkout only updates local selection.
     * It must not call OrderService.updateOrderAddress()
     * because the order has not been created yet.
     */
    this.activeAddress.set(selectedAddress);

    localStorage.setItem(
      'selectedAddress',
      JSON.stringify(selectedAddress)
    );

    this.checkRadius(selectedAddress);

    this.savingCheckoutAddress.set(false);

    this.hideCheckoutAddressOffcanvas();

    this.showToast(
      'Delivery address updated successfully.',
      'success'
    );
  }

  private hideCheckoutAddressOffcanvas(): void {
    const offcanvasElement = document.getElementById(
      'checkoutAddressOffcanvas'
    );

    if (!offcanvasElement) {
      return;
    }

    const instance =
      bootstrap.Offcanvas.getInstance(offcanvasElement) ??
      bootstrap.Offcanvas.getOrCreateInstance(
        offcanvasElement
      );

    instance.hide();
  }

  getAddressLabel(
    address: AddressResponse | null
  ): string {
    if (!address) {
      return '';
    }

    if (
      address.label === 'OTHER' &&
      address.customLabel?.trim()
    ) {
      return address.customLabel.trim();
    }

    return address.label;
  }

  getAddressLine(
    address: AddressResponse | null
  ): string {
    if (!address) {
      return '';
    }

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

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const earthRadiusKm = 6371;

    const latitudeDifference =
      ((lat2 - lat1) * Math.PI) / 180;

    const longitudeDifference =
      ((lon2 - lon1) * Math.PI) / 180;

    const value =
      Math.sin(latitudeDifference / 2) *
        Math.sin(latitudeDifference / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(longitudeDifference / 2) *
        Math.sin(longitudeDifference / 2);

    const angle =
      2 *
      Math.atan2(
        Math.sqrt(value),
        Math.sqrt(1 - value)
      );

    return earthRadiusKm * angle;
  }

  private getDistanceToRestaurant(
    address: AddressResponse
  ): number | null {
    const snapshot =
      this.cartService.restaurantSnapshot();

    if (
      snapshot?.latitude == null ||
      snapshot?.longitude == null ||
      address.latitude == null ||
      address.longitude == null
    ) {
      return null;
    }

    return this.haversineKm(
      snapshot.latitude,
      snapshot.longitude,
      address.latitude,
      address.longitude
    );
  }

  private checkRadius(address: AddressResponse): void {
    const distance =
      this.getDistanceToRestaurant(address);

    if (distance === null) {
      this.straightLineDistanceKm.set(null);
      this.outOfRange.set(false);
      return;
    }

    this.straightLineDistanceKm.set(
      Math.round(distance * 10) / 10
    );

    this.outOfRange.set(
      distance > MAX_DELIVERY_DISTANCE_KM
    );
  }

  /*
   * =================================================
   * Coupon handling
   * =================================================
   */

  private setCouponMessage(
    message: string,
    type: 'success' | 'error'
  ): void {
    this.couponMessage.set(message);
    this.couponMessageType.set(type);
  }

  loadCoupons(): void {
    const restaurantId =
      this.cartService.restaurantId();

    if (!restaurantId) {
      return;
    }

    this.loadingCoupons.set(true);

    let globalDone = false;
    let restaurantDone = false;

    const checkDone = () => {
      if (globalDone && restaurantDone) {
        this.loadingCoupons.set(false);
      }
    };

    this.couponService.getGlobalCoupons().subscribe({
      next: globalCoupons => {
        this.globalCoupons.set(globalCoupons ?? []);
        globalDone = true;
        checkDone();
      },

      error: () => {
        this.globalCoupons.set([]);
        globalDone = true;
        checkDone();
      }
    });

    this.couponService
      .getRestaurantCoupons(restaurantId)
      .subscribe({
        next: restaurantCoupons => {
          this.restaurantCoupons.set(
            restaurantCoupons ?? []
          );

          restaurantDone = true;
          checkDone();
        },

        error: () => {
          this.restaurantCoupons.set([]);
          restaurantDone = true;
          checkDone();
        }
      });
  }

  applyCoupon(): void {
    const code = this.couponCode()
      .trim()
      .toUpperCase();

    if (!code) {
      this.setCouponMessage(
        'Enter coupon code',
        'error'
      );

      return;
    }

    this.validateAndApplyCoupon(code, true);
  }

  applySuggestedCoupon(coupon: Coupon): void {
    this.couponCode.set(coupon.code);
    this.validateAndApplyCoupon(coupon.code, true);
  }

  private findCouponByCode(
    code: string
  ): Coupon | null {
    const allCoupons = [
      ...this.globalCoupons(),
      ...this.restaurantCoupons()
    ];

    return (
      allCoupons.find(
        coupon =>
          coupon.code.toUpperCase() ===
          code.toUpperCase()
      ) ?? null
    );
  }

  private validateAndApplyCoupon(
    code: string,
    showSuccessMessage = true
  ): void {
    const restaurantId =
      this.cartService.restaurantId();

    if (!restaurantId) {
      this.setCouponMessage(
        'Restaurant not found for this cart',
        'error'
      );

      return;
    }

    this.couponService.applyCoupon({
      couponCode: code,
      restaurantId,
      orderAmount: this.subtotal()
    }).subscribe({
      next: (response: ApplyCouponResponse) => {
        this.discountAmount.set(
          response.discountAmount || 0
        );

        this.appliedCoupon.set(
          this.findCouponByCode(code)
        );

        if (showSuccessMessage) {
          this.setCouponMessage(
            response.message ||
              'Coupon applied successfully',
            'success'
          );
        } else {
          this.setCouponMessage(
            `Discount updated for coupon ${code}.`,
            'success'
          );
        }

        this.closeOffersModal();
      },

      error: error => {
        this.handleCouponError(code, error);
      }
    });
  }

  private closeOffersModal(): void {
    const modalElement = document.getElementById(
      'offersModal'
    );

    if (!modalElement) {
      return;
    }

    const modal =
      bootstrap.Modal.getInstance(modalElement) ??
      bootstrap.Modal.getOrCreateInstance(
        modalElement
      );

    modal.hide();
  }

  private handleCouponError(
    code: string,
    error: any
  ): void {
    const existingCoupon =
      this.findCouponByCode(code);

    this.discountAmount.set(0);
    this.appliedCoupon.set(null);

    if (existingCoupon) {
      const minimumOrderAmount =
        existingCoupon.minOrderAmount || 0;

      const amountNeeded = Math.max(
        0,
        minimumOrderAmount - this.subtotal()
      );

      if (amountNeeded > 0) {
        const message =
          `Add ₹${amountNeeded} more to apply coupon ` +
          `${existingCoupon.code}. Minimum order value is ` +
          `₹${minimumOrderAmount}.`;

        this.setCouponMessage(message, 'error');
        this.showToast(message, 'warning');
        return;
      }

      const message =
        error?.error?.message ||
        `Coupon ${existingCoupon.code} ` +
          'is not applicable for this cart.';

      this.setCouponMessage(message, 'error');
      this.showToast(message, 'error');

      return;
    }

    const message =
      error?.error?.message ||
      'Invalid coupon code';

    this.setCouponMessage(message, 'error');
    this.showToast(message, 'error');
  }

  private scheduleCouponRecheck(code: string): void {
    if (this.isRecheckingCoupon) {
      return;
    }

    if (this.couponRecheckTimer) {
      clearTimeout(this.couponRecheckTimer);
    }

    this.couponRecheckTimer = setTimeout(() => {
      this.recheckAppliedCoupon(code);
    }, 300);
  }

  private recheckAppliedCoupon(code: string): void {
    const restaurantId =
      this.cartService.restaurantId();

    if (!restaurantId || !this.appliedCoupon()) {
      return;
    }

    this.isRecheckingCoupon = true;

    this.couponService.applyCoupon({
      couponCode: code,
      restaurantId,
      orderAmount: this.subtotal()
    }).subscribe({
      next: (response: ApplyCouponResponse) => {
        this.discountAmount.set(
          response.discountAmount || 0
        );

        this.isRecheckingCoupon = false;
      },

      error: () => {
        const coupon = this.appliedCoupon();

        if (coupon) {
          this.removeInvalidCoupon(coupon);
        }

        this.isRecheckingCoupon = false;
      }
    });
  }

  private removeInvalidCoupon(coupon: Coupon): void {
    this.discountAmount.set(0);
    this.appliedCoupon.set(null);
    this.couponCode.set('');

    this.setCouponMessage(
      `Coupon ${coupon.code} removed. Minimum order ` +
      `value ₹${coupon.minOrderAmount} is no longer met.`,
      'error'
    );
  }

  removeCoupon(): void {
    this.couponCode.set('');
    this.couponMessage.set('');
    this.appliedCoupon.set(null);
    this.discountAmount.set(0);

    if (this.couponRecheckTimer) {
      clearTimeout(this.couponRecheckTimer);
      this.couponRecheckTimer = null;
    }
  }

  getCouponBenefitText(coupon: Coupon): string {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}% off`;
    }

    if (coupon.discountType === 'FREE_DELIVERY') {
      return 'Free delivery';
    }

    return `₹${coupon.discountValue} off`;
  }

  /*
   * =================================================
   * Cart and payment
   * =================================================
   */

  addMoreItems(): void {
    const restaurantId =
      this.cartService.restaurantId();

    if (!restaurantId) {
      return;
    }

    this.router.navigate([
      '/home/restaurant',
      restaurantId
    ]);
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

  private buildDeliveryAddress(
    address: AddressResponse
  ) {
    return {
      addressId: address.id ?? null,
      label: address.label ?? '',
      customLabel: address.customLabel ?? '',
      receiverName: address.receiverName ?? '',
      phoneNumber: address.phoneNumber ?? '',
      addressLine1: address.addressLine1 ?? '',
      addressLine2: address.addressLine2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      isDefault: !!address.isDefault
    };
  }

  private buildRestaurantSnapshot():
    | OrderRestaurantSnapshotRequest
    | null {
    const snapshot =
      this.cartService.restaurantSnapshot();

    if (!snapshot) {
      return null;
    }

    return {
      location: snapshot.location ?? '',
      cuisine: snapshot.cuisine ?? '',
      latitude: snapshot.latitude ?? null,
      longitude: snapshot.longitude ?? null,
      distanceKm: snapshot.distanceKm ?? null,
      estimatedMinutes:
        snapshot.estimatedMinutes ?? null
    };
  }

  /*
   * =================================================
   * Place order
   * =================================================
   */

  placeOrder(): void {
    if (this.placingOrder()) {
      return;
    }

    const restaurantId =
      this.cartService.restaurantId();

    const address = this.activeAddress();

    if (this.cartService.cart().length === 0) {
      this.showToast('Cart is empty', 'warning');
      return;
    }

    if (!restaurantId) {
      this.showToast(
        'Restaurant not found',
        'error'
      );

      return;
    }

    if (!address) {
      this.showToast(
        'Select a delivery address to continue.',
        'warning'
      );

      return;
    }

    if (this.outOfRange()) {
      this.showToast(
        `This restaurant is ${this.straightLineDistanceKm()} km away — ` +
        `beyond our ${MAX_DELIVERY_DISTANCE_KM} km delivery range.`,
        'warning'
      );

      return;
    }

    const coupon = this.appliedCoupon();

    if (
      coupon &&
      this.subtotal() < coupon.minOrderAmount
    ) {
      this.removeInvalidCoupon(coupon);

      this.showToast(
        `Coupon ${coupon.code} is no longer valid for ` +
        'the updated cart total.',
        'warning'
      );

      return;
    }

    this.placingOrder.set(true);

    const payload: PlaceOrderRequest = {
      restaurantId,
      restaurantName: this.cartService.restaurantName(),
      items: this.cartService.cart().map(cartItem => ({
        menuItemId: cartItem.item.id!,
        itemName: cartItem.item.name,
        price: cartItem.item.price,
        quantity: cartItem.qty
      })),
      couponCode: this.appliedCoupon()?.code || null,
      paymentMethod: this.selectedPaymentMethod(),
      deliveryAddress: this.buildDeliveryAddress(address),
      restaurantSnapshot: this.buildRestaurantSnapshot()
    };

    this.orderService.placeOrder(payload).subscribe({
      next: response => {
        const placedOrderId = response?.id;

        this.showToast(
          this.selectedPaymentMethod() ===
            'CASH_ON_DELIVERY'
            ? 'Order placed successfully!'
            : 'Payment successful and order placed!',
          'success'
        );

        this.triggerCelebration(() => {
          this.cartService.clearCart();
          this.removeCoupon();
          this.placingOrder.set(false);

          if (placedOrderId) {
            this.router.navigate([
              '/home/order-tracking',
              placedOrderId
            ]);
            return;
          }

          this.router.navigate(['/home/orders']);
        });
      },

      error: error => {
        this.placingOrder.set(false);

        this.showToast(
          error?.error?.message ||
          'Failed to place order. Please try again.',
          'error'
        );
      }
    });
  }
}