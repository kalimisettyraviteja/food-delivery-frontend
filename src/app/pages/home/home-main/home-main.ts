import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Observable,
  Subscription,
  forkJoin,
  of
} from 'rxjs';
import {
  catchError,
  map
} from 'rxjs/operators';
import {
  Coupon,
  CouponService
} from '../../../core/services/coupon';
import {
  Restaurant,
  RestaurantSearchRequest,
  RestaurantService
} from '../../../core/services/restaurant';
import {
  AddressResponse,
  UserService
} from '../../../core/services/user';
import {
  OrderService,
  OrderStatus,
  OrderSummaryResponse
} from '../../../core/services/order';

declare const bootstrap: any;

@Component({
  selector: 'app-home-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-main.html',
  styleUrl: './home-main.css'
})
export class HomeMain
  implements OnInit, OnDestroy, AfterViewInit {
  private readonly restaurantService = inject(RestaurantService);
  private readonly couponService = inject(CouponService);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly orderService = inject(OrderService);

  @ViewChild('signInToast')
  signInToastRef!: ElementRef<HTMLElement>;

  @ViewChild('ordersScroller')
  ordersScrollerRef?: ElementRef<HTMLDivElement>;

  restaurants = signal<Restaurant[]>([]);
  filtered = signal<Restaurant[]>([]);
  loading = signal(true);

  addresses = signal<AddressResponse[]>([]);
  selectedAddress = signal<AddressResponse | null>(null);

  activeOrders = signal<OrderSummaryResponse[]>([]);
  loadingActiveOrders = signal(false);
  currentOrderIndex = signal(0);

  /*
   * Holds exactly one chosen restaurant-specific coupon per restaurant.
   * The selected coupon remains stable while this Home component exists.
   */
  restaurantCouponById = signal<Record<number, Coupon | null>>({});

  searchText = '';
  vegOnly = false;

  isLoggedIn = false;
  showScrollTop = false;
  hasLoadError = false;
  isAnyOffcanvasOpen = false;

  readonly skeletonItems = Array.from({ length: 8 });

  private toastInstance: any;
  private authSub?: Subscription;

  private autoScrollTimer:
    | ReturnType<typeof setInterval>
    | null = null;

  private refreshOrdersTimer:
    | ReturnType<typeof setInterval>
    | null = null;

  private offcanvasShownHandler?: EventListener;
  private offcanvasHiddenHandler?: EventListener;

  ngOnInit(): void {
    this.isLoggedIn = this.userService.isLoggedIn();

    this.loadRestaurants();
    this.loadActiveOrders(false);
    this.startOrdersAutoRefresh();
    this.updateScrollButton();

    this.authSub = this.userService.isLoggedIn$.subscribe(
      loggedIn => {
        this.isLoggedIn = loggedIn;

        if (!loggedIn) {
          this.vegOnly = false;

          localStorage.removeItem('selectedRestaurant');
          localStorage.removeItem('selectedAddress');
          localStorage.removeItem('selectedAddressId');

          this.addresses.set([]);
          this.selectedAddress.set(null);
          this.activeOrders.set([]);
          this.currentOrderIndex.set(0);
          this.restaurantCouponById.set({});

          this.stopAutoScroll();
          this.stopOrdersAutoRefresh();
        } else {
          this.startOrdersAutoRefresh();
        }

        this.loadRestaurants();
        this.loadActiveOrders(false);
      }
    );
  }

  ngAfterViewInit(): void {
    if (this.signInToastRef?.nativeElement) {
      this.toastInstance = new bootstrap.Toast(
        this.signInToastRef.nativeElement,
        {
          autohide: true,
          delay: 2500
        }
      );
    }

    this.registerOffcanvasListeners();
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();

    this.stopAutoScroll();
    this.stopOrdersAutoRefresh();
    this.unregisterOffcanvasListeners();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateScrollButton();
  }

  updateScrollButton(): void {
    this.showScrollTop = window.scrollY > 260;
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  /* =================================================
     Offcanvas visibility
     ================================================= */

  private registerOffcanvasListeners(): void {
    const offcanvasElements = Array.from(
      document.querySelectorAll<HTMLElement>('.offcanvas')
    );

    this.offcanvasShownHandler = () => {
      this.isAnyOffcanvasOpen = true;
    };

    this.offcanvasHiddenHandler = () => {
      window.setTimeout(() => {
        this.isAnyOffcanvasOpen =
          document.querySelector('.offcanvas.show') !== null;
      }, 0);
    };

    offcanvasElements.forEach(element => {
      element.addEventListener(
        'shown.bs.offcanvas',
        this.offcanvasShownHandler as EventListener
      );

      element.addEventListener(
        'hidden.bs.offcanvas',
        this.offcanvasHiddenHandler as EventListener
      );
    });
  }

  private unregisterOffcanvasListeners(): void {
    const offcanvasElements = Array.from(
      document.querySelectorAll<HTMLElement>('.offcanvas')
    );

    offcanvasElements.forEach(element => {
      if (this.offcanvasShownHandler) {
        element.removeEventListener(
          'shown.bs.offcanvas',
          this.offcanvasShownHandler
        );
      }

      if (this.offcanvasHiddenHandler) {
        element.removeEventListener(
          'hidden.bs.offcanvas',
          this.offcanvasHiddenHandler
        );
      }
    });

    this.offcanvasShownHandler = undefined;
    this.offcanvasHiddenHandler = undefined;
  }

  /* =================================================
     Restaurant and address loading
     ================================================= */

  loadRestaurants(): void {
    this.loading.set(true);
    this.hasLoadError = false;

    const loggedIn = this.userService.isLoggedIn();
    this.isLoggedIn = loggedIn;

    if (!loggedIn) {
      this.vegOnly = false;

      this.addresses.set([]);
      this.selectedAddress.set(null);
      this.restaurantCouponById.set({});

      localStorage.removeItem('selectedAddress');
      localStorage.removeItem('selectedAddressId');
      localStorage.removeItem('selectedRestaurant');

      this.fetchRestaurants({});
      return;
    }

    this.userService
      .getSavedAddresses()
      .pipe(
        catchError(() => of([] as AddressResponse[]))
      )
      .subscribe(addresses => {
        this.addresses.set(addresses);

        if (addresses.length === 0) {
          this.selectedAddress.set(null);
          this.restaurantCouponById.set({});

          localStorage.removeItem('selectedAddress');
          localStorage.removeItem('selectedAddressId');
          localStorage.removeItem('selectedRestaurant');

          this.fetchRestaurants({});
          return;
        }

        const savedAddressId =
          this.userService.getSelectedAddressId();

        const savedAddress = savedAddressId
          ? addresses.find(
              address => address.id === savedAddressId
            )
          : null;

        const activeAddress =
          savedAddress ||
          addresses.find(address => address.isDefault) ||
          addresses[0];

        if (!activeAddress?.id) {
          this.selectedAddress.set(null);
          this.restaurantCouponById.set({});

          localStorage.removeItem('selectedAddress');
          localStorage.removeItem('selectedAddressId');

          this.fetchRestaurants({});
          return;
        }

        this.userService.setSelectedAddressId(
          activeAddress.id
        );

        localStorage.setItem(
          'selectedAddressId',
          String(activeAddress.id)
        );

        localStorage.setItem(
          'selectedAddress',
          JSON.stringify(activeAddress)
        );

        this.selectedAddress.set(activeAddress);

        this.fetchRestaurants(
          this.buildSearchPayload(activeAddress)
        );
      });
  }

  onAddressChange(address: AddressResponse): void {
    if (!address?.id) {
      return;
    }

    this.userService.setSelectedAddressId(address.id);

    localStorage.setItem(
      'selectedAddressId',
      String(address.id)
    );

    localStorage.setItem(
      'selectedAddress',
      JSON.stringify(address)
    );

    this.selectedAddress.set(address);

    this.loading.set(true);
    this.hasLoadError = false;
    this.restaurantCouponById.set({});

    this.fetchRestaurants(
      this.buildSearchPayload(address)
    );
  }

  private buildSearchPayload(
    address: AddressResponse | null
  ): RestaurantSearchRequest {
    if (
      address?.latitude !== null &&
      address?.latitude !== undefined &&
      address?.longitude !== null &&
      address?.longitude !== undefined
    ) {
      return {
        lat: address.latitude,
        lng: address.longitude
      };
    }

    return {};
  }

  private fetchRestaurants(
    payload: RestaurantSearchRequest
  ): void {
    this.restaurantService
      .searchRestaurants(payload)
      .subscribe({
        next: restaurants => {
          const list = restaurants ?? [];

          this.restaurants.set(list);
          this.applyRestaurantView();
          this.loading.set(false);

          if (this.userService.isLoggedIn()) {
            this.loadRestaurantCoupons(list);
          } else {
            this.restaurantCouponById.set({});
          }
        },

        error: () => {
          this.restaurants.set([]);
          this.filtered.set([]);
          this.restaurantCouponById.set({});
          this.hasLoadError = true;
          this.loading.set(false);
        }
      });
  }

  reloadRestaurants(): void {
    this.loadRestaurants();
    this.loadActiveOrders(false);
  }

  /* =================================================
     Veg-only filter
     ================================================= */

  onVegOnlyChange(): void {
    if (!this.userService.isLoggedIn()) {
      this.vegOnly = false;
    }

    this.applyRestaurantView();
  }

  clearVegOnlyFilter(): void {
    this.vegOnly = false;
    this.applyRestaurantView();
  }

  /* =================================================
     Restaurant coupon loading
     ================================================= */

  private loadRestaurantCoupons(
    restaurants: Restaurant[]
  ): void {
    if (!this.userService.isLoggedIn()) {
      this.restaurantCouponById.set({});
      return;
    }

    const couponRequests: Observable<{
      restaurantId: number;
      coupon: Coupon | null;
    }>[] = restaurants
      .filter(
        restaurant =>
          restaurant.id !== null &&
          restaurant.id !== undefined
      )
      .map(restaurant =>
        this.couponService
          .getRestaurantCoupons(restaurant.id as number)
          .pipe(
            map(coupons => ({
              restaurantId: restaurant.id as number,
              coupon: this.pickRandomValidRestaurantCoupon(
                coupons ?? [],
                restaurant.id as number
              )
            })),
            catchError(() =>
              of({
                restaurantId: restaurant.id as number,
                coupon: null
              })
            )
          )
      );

    if (couponRequests.length === 0) {
      this.restaurantCouponById.set({});
      return;
    }

    forkJoin(couponRequests).subscribe(results => {
      if (!this.userService.isLoggedIn()) {
        this.restaurantCouponById.set({});
        return;
      }

      const couponMap: Record<number, Coupon | null> = {};

      results.forEach(result => {
        couponMap[result.restaurantId] = result.coupon;
      });

      this.restaurantCouponById.set(couponMap);
    });
  }

  /*
   * Picks one random eligible restaurant-specific coupon.
   *
   * Global coupons are explicitly excluded even if the API
   * accidentally returns them in a restaurant coupon response.
   *
   * The current map is checked first so the same restaurant
   * does not keep changing offers during Angular rendering.
   */
  private pickRandomValidRestaurantCoupon(
    coupons: Coupon[],
    restaurantId: number
  ): Coupon | null {
    const currentCoupon =
      this.restaurantCouponById()[restaurantId] ?? null;

    const validCoupons = coupons.filter(
      coupon =>
        this.isRestaurantCouponForRestaurant(
          coupon,
          restaurantId
        ) &&
        this.isCouponValid(coupon)
    );

    if (validCoupons.length === 0) {
      return null;
    }

    if (
      currentCoupon &&
      validCoupons.some(
        coupon => coupon.id === currentCoupon.id
      )
    ) {
      return currentCoupon;
    }

    const randomIndex = Math.floor(
      Math.random() * validCoupons.length
    );

    return validCoupons[randomIndex];
  }

  /*
   * Restaurant cards must not display global coupons.
   * A restaurant coupon must be specifically assigned
   * to the same restaurant ID as the card.
   */
  private isRestaurantCouponForRestaurant(
    coupon: Coupon,
    restaurantId: number
  ): boolean {
    if (!coupon) {
      return false;
    }

    return (
      coupon.scope === 'RESTAURANT' &&
      Number(coupon.restaurantId) === Number(restaurantId)
    );
  }

  /*
   * Valid means:
   * - coupon is active
   * - coupon has not expired
   * - an invalid/unparseable expiry date is rejected
   *
   * For a LocalDate string such as 2027-12-31, compare using
   * the end of the local calendar day so it stays usable for
   * the entire expiry day.
   */
  private isCouponValid(coupon: Coupon): boolean {
    if (!coupon?.active) {
      return false;
    }

    if (!coupon.expiryDate) {
      return true;
    }

    const expiryText = String(coupon.expiryDate)
      .trim()
      .slice(0, 10);

    const expiryDate = new Date(
      `${expiryText}T23:59:59.999`
    );

    if (Number.isNaN(expiryDate.getTime())) {
      return false;
    }

    return expiryDate.getTime() >= Date.now();
  }

  getRestaurantCoupon(
    restaurant: Restaurant
  ): Coupon | null {
    if (
      !this.userService.isLoggedIn() ||
      restaurant.id === null ||
      restaurant.id === undefined
    ) {
      return null;
    }

    return this.restaurantCouponById()[restaurant.id] ?? null;
  }

  getCouponLabel(coupon: Coupon): string {
    if (coupon.discountType === 'FLAT') {
      return `Flat ₹${this.formatCouponNumber(
        coupon.discountValue
      )} OFF`;
    }

    if (coupon.discountType === 'PERCENTAGE') {
      const percentage = this.formatCouponNumber(
        coupon.discountValue
      );

      const maxDiscount =
        Number(coupon.maxDiscountAmount) || 0;

      if (maxDiscount > 0) {
        return `${percentage}% OFF up to ₹${this.formatCouponNumber(
          maxDiscount
        )}`;
      }

      return `${percentage}% OFF`;
    }

    if (coupon.discountType === 'FREE_DELIVERY') {
      return 'Free delivery';
    }

    return coupon.description || 'Special offer';
  }

  getCouponTooltip(coupon: Coupon): string {
    const minimumOrder =
      Number(coupon.minOrderAmount) || 0;

    const minimumOrderText =
      minimumOrder > 0
        ? ` · On orders above ₹${this.formatCouponNumber(
            minimumOrder
          )}`
        : '';

    const codeText = coupon.code
      ? `${coupon.code} · `
      : '';

    return `${codeText}${this.getCouponLabel(
      coupon
    )}${minimumOrderText}`;
  }

  private formatCouponNumber(value: number): string {
    return (Number(value) || 0).toLocaleString(
      'en-IN',
      {
        maximumFractionDigits: 0
      }
    );
  }

  /* =================================================
     Search and display filters
     ================================================= */

  onSearch(): void {
    this.applyRestaurantView();
  }

  clearSearch(): void {
    this.searchText = '';
    this.applyRestaurantView();
  }

  private applyRestaurantView(): void {
    const query = this.searchText.trim().toLowerCase();
    const restaurantList = this.restaurants();

    const vegFilterEnabled =
      this.userService.isLoggedIn() &&
      this.vegOnly;

    this.filtered.set(
      restaurantList.filter(restaurant => {
        const matchesSearch =
          !query ||
          (restaurant.name || '').toLowerCase().includes(query) ||
          (restaurant.cuisine || '').toLowerCase().includes(query) ||
          (restaurant.location || '').toLowerCase().includes(query);

        const matchesVegOnly =
          !vegFilterEnabled ||
          restaurant.isPureVeg === true;

        return matchesSearch && matchesVegOnly;
      })
    );
  }

  getRestaurantImage(restaurant: Restaurant): string {
    const imageSource = restaurant as Restaurant & {
      photo?: string | null;
      bannerImage?: string | null;
      coverImage?: string | null;
    };

    return (
      imageSource.imageUrl ||
      imageSource.image ||
      imageSource.photo ||
      imageSource.bannerImage ||
      imageSource.coverImage ||
      ''
    );
  }

  hasRestaurantImage(restaurant: Restaurant): boolean {
    return Boolean(
      this.getRestaurantImage(restaurant).trim()
    );
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;

    image.style.display = 'none';

    image.parentElement?.classList.add('image-failed');
  }

  private removeFocusFromActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  }

  private storeSelectedRestaurant(
    restaurant: Restaurant
  ): void {
    if (!this.userService.isLoggedIn()) {
      localStorage.removeItem('selectedRestaurant');
      return;
    }

    localStorage.setItem(
      'selectedRestaurant',
      JSON.stringify(restaurant)
    );
  }

  openRestaurant(restaurant: Restaurant): void {
    const loggedInNow = this.userService.isLoggedIn();

    if (!loggedInNow) {
      this.isLoggedIn = false;
      this.vegOnly = false;

      this.removeFocusFromActiveElement();
      this.showSignInToast();

      return;
    }

    this.isLoggedIn = true;

    if (restaurant.isActive === false) {
      return;
    }

    this.storeSelectedRestaurant(restaurant);

    this.removeFocusFromActiveElement();

    this.router.navigate([
      '/home/restaurant',
      restaurant.id
    ]);
  }

  showSignInToast(): void {
    if (!this.toastInstance && this.signInToastRef?.nativeElement) {
      this.toastInstance = new bootstrap.Toast(
        this.signInToastRef.nativeElement,
        {
          autohide: true,
          delay: 2500
        }
      );
    }

    this.toastInstance?.show();
  }

  getAddressLabelIcon(address: AddressResponse): string {
    if (address.label === 'HOME') {
      return 'bi-house-door-fill';
    }

    if (address.label === 'WORK') {
      return 'bi-briefcase-fill';
    }

    return 'bi-bookmark-fill';
  }

  goToSavedAddresses(): void {
    this.router.navigate(['home/addresses']);
  }

  trackByRestaurantId(
    _index: number,
    restaurant: Restaurant
  ): number | string {
    return restaurant.id ?? restaurant.name;
  }

  /* =================================================
     Active orders
     ================================================= */

  loadActiveOrders(preservePosition = true): void {
    if (!this.userService.isLoggedIn()) {
      this.activeOrders.set([]);
      this.loadingActiveOrders.set(false);
      this.currentOrderIndex.set(0);
      this.stopAutoScroll();
      return;
    }

    this.loadingActiveOrders.set(
      this.activeOrders().length === 0
    );

    const previousOrders = this.activeOrders();

    const previousCurrentOrderId =
      previousOrders[this.currentOrderIndex()]?.id ?? null;

    this.orderService
      .getMyOrders()
      .pipe(
        catchError(() => of([] as OrderSummaryResponse[]))
      )
      .subscribe(orders => {
        const latestActiveOrders = [...orders]
          .filter(order =>
            this.isActiveOrderStatus(order.status)
          )
          .sort(
            (first, second) =>
              new Date(second.createdAt).getTime() -
              new Date(first.createdAt).getTime()
          );

        this.activeOrders.set(latestActiveOrders);
        this.loadingActiveOrders.set(false);

        if (latestActiveOrders.length === 0) {
          this.currentOrderIndex.set(0);
          this.stopAutoScroll();
          return;
        }

        if (preservePosition && previousCurrentOrderId) {
          const matchingIndex = latestActiveOrders.findIndex(
            order => order.id === previousCurrentOrderId
          );

          if (matchingIndex >= 0) {
            this.currentOrderIndex.set(matchingIndex);
          } else {
            this.currentOrderIndex.set(
              Math.min(
                this.currentOrderIndex(),
                latestActiveOrders.length - 1
              )
            );
          }
        } else {
          this.currentOrderIndex.set(0);
        }

        setTimeout(() => {
          this.scrollToOrder(
            this.currentOrderIndex(),
            false
          );

          this.startAutoScroll();
        }, 120);
      });
  }

  private startOrdersAutoRefresh(): void {
    this.stopOrdersAutoRefresh();

    if (!this.userService.isLoggedIn()) {
      return;
    }

    this.refreshOrdersTimer = setInterval(() => {
      this.loadActiveOrders(true);
    }, 25000);
  }

  private stopOrdersAutoRefresh(): void {
    if (!this.refreshOrdersTimer) {
      return;
    }

    clearInterval(this.refreshOrdersTimer);
    this.refreshOrdersTimer = null;
  }

  private isActiveOrderStatus(
    status: OrderStatus
  ): boolean {
    return [
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'PICKED_UP',
      'OUT_FOR_DELIVERY'
    ].includes(status);
  }

  openOrderTracking(orderId: number): void {
    this.router.navigate([
      '/home/order-tracking',
      orderId
    ]);
  }

  scrollOrdersLeft(): void {
    const totalOrders = this.activeOrders().length;

    if (totalOrders <= 1) {
      return;
    }

    const nextIndex =
      this.currentOrderIndex() === 0
        ? totalOrders - 1
        : this.currentOrderIndex() - 1;

    this.scrollToOrder(nextIndex);
    this.restartAutoScroll();
  }

  scrollOrdersRight(): void {
    const totalOrders = this.activeOrders().length;

    if (totalOrders <= 1) {
      return;
    }

    const nextIndex =
      this.currentOrderIndex() === totalOrders - 1
        ? 0
        : this.currentOrderIndex() + 1;

    this.scrollToOrder(nextIndex);
    this.restartAutoScroll();
  }

  goToOrderSlide(index: number): void {
    this.scrollToOrder(index);
    this.restartAutoScroll();
  }

  getVisibleDotIndexes(): number[] {
    const totalOrders = this.activeOrders().length;

    if (totalOrders <= 3) {
      return Array.from(
        { length: totalOrders },
        (_item, index) => index
      );
    }

    const currentIndex = this.currentOrderIndex();

    if (currentIndex <= 1) {
      return [0, 1, 2];
    }

    if (currentIndex >= totalOrders - 2) {
      return [
        totalOrders - 3,
        totalOrders - 2,
        totalOrders - 1
      ];
    }

    return [
      currentIndex - 1,
      currentIndex,
      currentIndex + 1
    ];
  }

  private startAutoScroll(): void {
    this.stopAutoScroll();

    if (this.activeOrders().length <= 1) {
      return;
    }

    this.autoScrollTimer = setInterval(() => {
      const totalOrders = this.activeOrders().length;

      const nextIndex =
        this.currentOrderIndex() >= totalOrders - 1
          ? 0
          : this.currentOrderIndex() + 1;

      this.scrollToOrder(nextIndex);
    }, 4500);
  }

  private stopAutoScroll(): void {
    if (!this.autoScrollTimer) {
      return;
    }

    clearInterval(this.autoScrollTimer);
    this.autoScrollTimer = null;
  }

  private restartAutoScroll(): void {
    this.stopAutoScroll();
    this.startAutoScroll();
  }

  private scrollToOrder(
    index: number,
    smooth = true
  ): void {
    this.currentOrderIndex.set(index);

    const container =
      this.ordersScrollerRef?.nativeElement;

    if (!container) {
      return;
    }

    const slides = container.querySelectorAll<HTMLElement>(
      '.sticky-order-slide'
    );

    const targetSlide = slides[index];

    if (!targetSlide) {
      return;
    }

    targetSlide.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'start'
    });
  }

  onOrdersScroll(): void {
    const container =
      this.ordersScrollerRef?.nativeElement;

    if (!container) {
      return;
    }

    const slides = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.sticky-order-slide'
      )
    );

    if (slides.length === 0) {
      return;
    }

    const scrollPosition = container.scrollLeft;

    let closestIndex = 0;
    let closestDistance = Number.MAX_VALUE;

    slides.forEach((slide, index) => {
      const distance = Math.abs(
        slide.offsetLeft - scrollPosition
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    this.currentOrderIndex.set(closestIndex);
  }

  getEtaText(order: OrderSummaryResponse): string {
    let arrivalTimeInMilliseconds: number | null = null;

    if (order.estimatedDeliveryAt) {
      arrivalTimeInMilliseconds = new Date(
        order.estimatedDeliveryAt
      ).getTime();
    } else if (
      order.finalEstimatedDeliveryMinutes !== null &&
      order.finalEstimatedDeliveryMinutes !== undefined
    ) {
      arrivalTimeInMilliseconds =
        new Date(order.createdAt).getTime() +
        order.finalEstimatedDeliveryMinutes * 60000;
    }

    if (arrivalTimeInMilliseconds !== null) {
      const remainingMinutes = Math.ceil(
        (arrivalTimeInMilliseconds - Date.now()) / 60000
      );

      if (remainingMinutes <= 1) {
        return 'Arriving shortly';
      }

      return `Arriving in ${remainingMinutes} min`;
    }

    return 'ETA updating';
  }

  getActiveOrderStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PLACED':
        return 'Order placed';

      case 'CONFIRMED':
        return 'Restaurant confirmed';

      case 'PREPARING':
        return 'Preparing your food';

      case 'PICKED_UP':
        return 'Picked up by delivery partner';

      case 'OUT_FOR_DELIVERY':
        return 'Out for delivery';

      case 'DELIVERED':
        return 'Delivered';

      case 'CANCELLED':
        return 'Cancelled';

      default:
        return 'Processing';
    }
  }

  getActiveOrderStatusClass(status: OrderStatus): string {
    switch (status) {
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        return 'active-order-status-delivery';

      case 'CONFIRMED':
      case 'PREPARING':
      case 'PLACED':
        return 'active-order-status-progress';

      case 'DELIVERED':
        return 'active-order-status-success';

      case 'CANCELLED':
        return 'active-order-status-cancelled';

      default:
        return 'active-order-status-progress';
    }
  }

  getStickyOrderIcon(status: OrderStatus): string {
    switch (status) {
      case 'OUT_FOR_DELIVERY':
        return 'bi-bicycle';

      case 'PICKED_UP':
        return 'bi-bag-check-fill';

      case 'PREPARING':
        return 'bi-fire';

      case 'CONFIRMED':
        return 'bi-check2-circle';

      case 'PLACED':
      default:
        return 'bi-receipt';
    }
  }

  formatOrderStatus(status: OrderStatus): string {
    return status
      .toLowerCase()
      .split('_')
      .map(
        word =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(' ');
  }

  trackByOrderId(
    _index: number,
    order: OrderSummaryResponse
  ): number {
    return order.id;
  }
}