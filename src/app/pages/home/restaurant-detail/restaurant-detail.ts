import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  computed
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { RestaurantService, MenuItem, Restaurant } from '../../../core/services/restaurant';
import { CartService } from '../../../core/services/cart';
import { CouponService, Coupon } from '../../../core/services/coupon';
import { UserService } from '../../../core/services/user';

declare var bootstrap: any;

type FilterType = 'ALL' | 'VEG' | 'NON_VEG';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-detail.html',
  styleUrl: './restaurant-detail.css'
})
export class RestaurantDetail implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private restaurantService = inject(RestaurantService);
  private router = inject(Router);
  private couponService = inject(CouponService);
  private userService = inject(UserService);

  cartService = inject(CartService);

  restaurant = signal<Restaurant | null>(null);
  menuItems = signal<MenuItem[]>([]);
  loading = signal(true);

  selectedFilter = signal<FilterType>('ALL');
  searchText = signal('');

  previewImage = signal('');
  previewTitle = signal('');

  showScrollTop = signal(false);

  coupons = signal<Coupon[]>([]);
  currentCouponIndex = signal(0);
  copiedCouponId = signal<number | null>(null);
  selectedCoupon = signal<Coupon | null>(null);

  private imagePreviewModal: any;
  private couponDetailsModal: any;
  private couponSliderInterval: any;
  private copySuccessTimeout: any;
  private couponModalElement: HTMLElement | null = null;
  private imageModalElement: HTMLElement | null = null;
  private isCouponSliderPaused = false;
  private destroy$ = new Subject<void>();

  filteredMenuItems = computed(() => {
    const items = this.menuItems();
    const filter = this.selectedFilter();
    const searchValue = this.searchText().trim().toLowerCase();

    return items.filter(item => {
      const matchesSearch =
        !searchValue ||
        item.name.toLowerCase().includes(searchValue) ||
        (item.description ?? '').toLowerCase().includes(searchValue);

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'VEG' && item.veg) ||
        (filter === 'NON_VEG' && !item.veg);

      return matchesSearch && matchesFilter;
    });
  });

  activeCoupon = computed(() => {
    const couponList = this.coupons();
    if (!couponList.length) return null;
    return couponList[this.currentCouponIndex()] ?? null;
  });

  bestCouponId = computed(() => {
    const couponList = this.coupons();
    if (!couponList.length) return null;

    const bestCoupon = [...couponList].sort(
      (a, b) => this.getCouponPriorityValue(b) - this.getCouponPriorityValue(a)
    )[0];

    return bestCoupon?.id ?? null;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(paramMap => {
        const restaurantId = Number(paramMap.get('id'));

        console.log('[DETAIL] route param restaurantId =>', restaurantId);

        if (!restaurantId) {
          console.warn('[DETAIL] invalid restaurantId, redirecting to /home');
          this.loading.set(false);
          this.router.navigate(['/home']);
          return;
        }

        this.loadRestaurantDetailsPage(restaurantId);
      });
  }

  ngAfterViewInit(): void {
    const imageModal = document.getElementById('imagePreviewModal');
    if (imageModal) {
      this.imageModalElement = imageModal;
      this.imagePreviewModal = bootstrap.Modal.getOrCreateInstance(imageModal);

      imageModal.addEventListener('hide.bs.modal', this.handleModalHide);
      imageModal.addEventListener('hidden.bs.modal', this.handleImageModalHidden);
    }

    const couponModal = document.getElementById('couponDetailsModal');
    if (couponModal) {
      this.couponModalElement = couponModal;
      this.couponDetailsModal = bootstrap.Modal.getOrCreateInstance(couponModal);

      couponModal.addEventListener('show.bs.modal', this.handleCouponModalShow);
      couponModal.addEventListener('shown.bs.modal', this.handleCouponModalShown);
      couponModal.addEventListener('hide.bs.modal', this.handleModalHide);
      couponModal.addEventListener('hidden.bs.modal', this.handleCouponModalHidden);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopCouponSlider();

    if (this.copySuccessTimeout) {
      clearTimeout(this.copySuccessTimeout);
    }

    if (this.couponModalElement) {
      this.couponModalElement.removeEventListener('show.bs.modal', this.handleCouponModalShow);
      this.couponModalElement.removeEventListener('shown.bs.modal', this.handleCouponModalShown);
      this.couponModalElement.removeEventListener('hide.bs.modal', this.handleModalHide);
      this.couponModalElement.removeEventListener('hidden.bs.modal', this.handleCouponModalHidden);
    }

    if (this.imageModalElement) {
      this.imageModalElement.removeEventListener('hide.bs.modal', this.handleModalHide);
      this.imageModalElement.removeEventListener('hidden.bs.modal', this.handleImageModalHidden);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showScrollTop.set(window.scrollY > 300);
  }

  loadRestaurantDetailsPage(restaurantId: number): void {
    this.loading.set(true);
    this.menuItems.set([]);
    this.coupons.set([]);
    this.currentCouponIndex.set(0);
    this.selectedCoupon.set(null);
    this.stopCouponSlider();

    const storedRestaurant = this.getStoredRestaurant();

    console.log('[DETAIL] loadRestaurantDetailsPage start =>', {
      restaurantId,
      storedRestaurant
    });

    forkJoin({
      restaurant: this.restaurantService.getById(restaurantId),
      menu: this.restaurantService.getPublicMenu(restaurantId),
      restaurantCoupons: this.couponService.getRestaurantCoupons(restaurantId).pipe(
        catchError((error) => {
          console.error('[DETAIL] Restaurant coupons failed =>', error);
          return of([] as Coupon[]);
        })
      ),
      globalCoupons: this.couponService.getGlobalCoupons().pipe(
        catchError((error) => {
          console.error('[DETAIL] Global coupons failed =>', error);
          return of([] as Coupon[]);
        })
      )
    }).subscribe({
      next: ({ restaurant, menu, restaurantCoupons, globalCoupons }) => {
        console.log('[DETAIL] getById restaurant response =>', restaurant);

        const mergedRestaurant = this.mergeRestaurantData(storedRestaurant, restaurant);

        console.log('[DETAIL] merged restaurant =>', mergedRestaurant);

        this.restaurant.set(mergedRestaurant);
        this.storeSelectedRestaurant(mergedRestaurant);

        this.menuItems.set(menu);
        console.log('[DETAIL] menu items loaded =>', menu);

        const mergedCoupons = [...restaurantCoupons, ...globalCoupons];

        const uniqueCoupons = mergedCoupons.filter(
          (coupon, index, allCoupons) =>
            index === allCoupons.findIndex(currentCoupon => currentCoupon.id === coupon.id)
        );

        const displayableCoupons = uniqueCoupons
          .filter(coupon => this.canShowCoupon(coupon))
          .sort((a, b) => this.getCouponPriorityValue(b) - this.getCouponPriorityValue(a));

        this.coupons.set(displayableCoupons);
        this.currentCouponIndex.set(0);

        console.log('[DETAIL] final coupons =>', displayableCoupons);

        if (displayableCoupons.length > 1) {
          this.startCouponSlider();
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('[DETAIL] Failed to load restaurant detail page =>', error);
        this.restaurant.set(null);
        this.menuItems.set([]);
        this.coupons.set([]);
        this.loading.set(false);
      }
    });
  }

  private mergeRestaurantData(
    storedRestaurant: Restaurant | null,
    fetchedRestaurant: Restaurant
  ): Restaurant {
    if (!storedRestaurant || storedRestaurant.id !== fetchedRestaurant.id) {
      return fetchedRestaurant;
    }

    return {
      ...storedRestaurant,
      ...fetchedRestaurant,
      latitude: fetchedRestaurant.latitude ?? storedRestaurant.latitude ?? null,
      longitude: fetchedRestaurant.longitude ?? storedRestaurant.longitude ?? null,
      distanceKm: fetchedRestaurant.distanceKm ?? storedRestaurant.distanceKm ?? null,
      estimatedMinutes: fetchedRestaurant.estimatedMinutes ?? storedRestaurant.estimatedMinutes ?? null,
      image: fetchedRestaurant.image ?? storedRestaurant.image ?? null,
      imageUrl: fetchedRestaurant.imageUrl ?? storedRestaurant.imageUrl ?? null
    };
  }

  private storeSelectedRestaurant(restaurant: Restaurant): void {
    if (!this.userService.isLoggedIn()) {
      console.log('[DETAIL] user not logged in, clearing selectedRestaurant');
      localStorage.removeItem('selectedRestaurant');
      return;
    }

    console.log('[DETAIL] storing selectedRestaurant =>', restaurant);
    localStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
    console.log('[DETAIL] selectedRestaurant saved =>', localStorage.getItem('selectedRestaurant'));
  }

  private getStoredRestaurant(): Restaurant | null {
    if (!this.userService.isLoggedIn()) {
      localStorage.removeItem('selectedRestaurant');
      return null;
    }

    const raw = localStorage.getItem('selectedRestaurant');
    if (!raw) {
      console.log('[DETAIL] no selectedRestaurant in localStorage');
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Restaurant;
      console.log('[DETAIL] selectedRestaurant from localStorage =>', parsed);
      return parsed;
    } catch (error) {
      console.error('[DETAIL] failed to parse selectedRestaurant =>', error);
      localStorage.removeItem('selectedRestaurant');
      return null;
    }
  }

  private handleCouponModalShow = () => {
    this.removeFocusFromActiveElement();
  };

  private handleCouponModalShown = () => {
    this.pauseCouponSlider();
  };

  private handleCouponModalHidden = () => {
    this.removeFocusFromActiveElement();
    this.resumeCouponSlider();
  };

  private handleImageModalHidden = () => {
    this.removeFocusFromActiveElement();
  };

  private handleModalHide = (event: Event) => {
    const modalElement = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;

    if (modalElement && activeElement && modalElement.contains(activeElement)) {
      activeElement.blur();
    } else {
      this.removeFocusFromActiveElement();
    }
  };

  canShowCoupon(coupon: Coupon): boolean {
    if (!coupon.active) return false;
    if (!coupon.expiryDate) return true;

    const todayStart = new Date().setHours(0, 0, 0, 0);
    return new Date(coupon.expiryDate).getTime() >= todayStart;
  }

  getCouponPriorityValue(coupon: Coupon): number {
    if (coupon.discountType === 'FREE_DELIVERY') {
      return 60;
    }

    if (coupon.discountType === 'FLAT') {
      return Number(coupon.discountValue) || 0;
    }

    const percentageValue = Number(coupon.discountValue) || 0;
    const maxDiscount = Number(coupon.maxDiscountAmount || 0);

    return maxDiscount > 0 ? maxDiscount + percentageValue : percentageValue;
  }

  getDisplayEtaText(): string {
    const currentRestaurant = this.restaurant();

    if (!currentRestaurant) {
      return '20-25';
    }

    return currentRestaurant.estimatedMinutes != null
      ? String(currentRestaurant.estimatedMinutes)
      : '20-25';
  }

  getDisplayDistanceText(): string {
    const currentRestaurant = this.restaurant();

    if (!currentRestaurant || currentRestaurant.distanceKm == null) {
      return '';
    }

    return `${currentRestaurant.distanceKm} km`;
  }

  startCouponSlider(): void {
    this.stopCouponSlider();

    if (this.isCouponSliderPaused || this.coupons().length <= 1) {
      return;
    }

    this.couponSliderInterval = setInterval(() => {
      this.showNextCoupon();
    }, 2200);
  }

  stopCouponSlider(): void {
    if (this.couponSliderInterval) {
      clearInterval(this.couponSliderInterval);
      this.couponSliderInterval = null;
    }
  }

  pauseCouponSlider(): void {
    this.isCouponSliderPaused = true;
    this.stopCouponSlider();
  }

  resumeCouponSlider(): void {
    this.isCouponSliderPaused = false;
    this.startCouponSlider();
  }

  showNextCoupon(): void {
    const couponList = this.coupons();
    if (!couponList.length) return;

    this.currentCouponIndex.set((this.currentCouponIndex() + 1) % couponList.length);
  }

  showPreviousCoupon(): void {
    const couponList = this.coupons();
    if (!couponList.length) return;

    this.currentCouponIndex.set(
      (this.currentCouponIndex() - 1 + couponList.length) % couponList.length
    );
  }

  openCouponDetails(coupon: Coupon): void {
    this.selectedCoupon.set(coupon);
    this.pauseCouponSlider();
    this.removeFocusFromActiveElement();

    setTimeout(() => {
      this.couponDetailsModal?.show();
    }, 0);
  }

  async copyCouponText(code: string, couponId: number, event?: Event): Promise<void> {
    event?.stopPropagation();

    try {
      await navigator.clipboard.writeText(code);
      this.copiedCouponId.set(couponId);

      if (this.copySuccessTimeout) {
        clearTimeout(this.copySuccessTimeout);
      }

      this.copySuccessTimeout = setTimeout(() => {
        this.copiedCouponId.set(null);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy coupon code', error);
    }
  }

  updateSearchText(value: string): void {
    this.searchText.set(value);
  }

  changeFilter(filter: FilterType): void {
    this.selectedFilter.set(filter);
  }

  openDishImagePreview(image: string | null | undefined, title: string): void {
    if (!image) return;

    this.previewImage.set(image);
    this.previewTitle.set(title);
    this.removeFocusFromActiveElement();
    this.imagePreviewModal?.show();
  }

  scrollPageToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  isMenuItemUnavailable(item: MenuItem): boolean {
    return item.isAvailable === false;
  }

  isAddDisabled(item: MenuItem): boolean {
    return this.isMenuItemUnavailable(item) || this.restaurant()?.isActive === false;
  }

  getAddButtonText(item: MenuItem): string {
    return this.isMenuItemUnavailable(item) ? 'UNAVAILABLE' : 'ADD';
  }

  getAddButtonTitle(item: MenuItem): string {
    if (this.isMenuItemUnavailable(item)) {
      return 'This item is currently unavailable';
    }

    if (this.restaurant()?.isActive === false) {
      return 'This restaurant is currently unavailable';
    }

    return 'Add to cart';
  }

  addItemToCart(item: MenuItem): void {
    if (this.isAddDisabled(item)) return;

    console.log('[DETAIL] addItemToCart =>', {
      item,
      restaurant: this.restaurant()
    });

    this.cartService.addToCart(item, this.restaurant());
  }

  increaseItemQuantity(itemId: number): void {
    const item = this.menuItems().find(menuItem => menuItem.id === itemId);
    if (!item || this.isAddDisabled(item)) return;

    this.cartService.increaseQty(itemId);
  }

  decreaseItemQuantity(itemId: number): void {
    this.cartService.decreaseQty(itemId);
  }

  getQuantityInCart(itemId: number): number {
    const itemInCart = this.cartService.cart().find(cartItem => cartItem.item.id === itemId);
    return itemInCart ? itemInCart.qty : 0;
  }

  goToCheckoutPage(): void {
    if (this.cartService.cart().length === 0) return;
    this.router.navigate(['/home/checkout']);
  }

  getCouponOfferTitle(coupon: Coupon): string {
    switch (coupon.discountType) {
      case 'FLAT':
        return `Flat ₹${coupon.discountValue} Off`;
      case 'PERCENTAGE':
        return `${coupon.discountValue}% Off`;
      case 'FREE_DELIVERY':
        return 'Free Delivery';
      default:
        return 'Offer';
    }
  }

  getCouponMinimumOrderText(coupon: Coupon): string {
    return `Minimum order amount ₹${coupon.minOrderAmount}`;
  }

  getCouponMaximumDiscountText(coupon: Coupon): string {
    if (coupon.discountType !== 'PERCENTAGE' || !coupon.maxDiscountAmount) {
      return '';
    }

    return `Maximum discount ₹${coupon.maxDiscountAmount}`;
  }

  getCouponExpiryDisplayText(coupon: Coupon): string {
    if (!coupon.expiryDate) {
      return 'Limited period offer';
    }

    const expiryDate = new Date(coupon.expiryDate);

    return `Offer valid till ${expiryDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
  }

  removeFocusFromActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  }
}