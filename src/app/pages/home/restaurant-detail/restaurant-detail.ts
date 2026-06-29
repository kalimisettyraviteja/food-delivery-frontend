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
import { RestaurantService, MenuItem, Restaurant } from '../../../core/services/restaurant';
import { CartService } from '../../../core/services/cart';
import { CouponService, Coupon } from '../../../core/services/coupon';
import { forkJoin } from 'rxjs';

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
  private svc = inject(RestaurantService);
  private router = inject(Router);
  private couponService = inject(CouponService);

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

  private previewModal: any;
  private couponDetailsModal: any;
  private couponInterval: any;
  private copyResetTimeout: any;
  private couponModalEl: HTMLElement | null = null;
  private imageModalEl: HTMLElement | null = null;
  private isCouponPaused = false;

  filteredMenuItems = computed(() => {
    const items = this.menuItems();
    const filter = this.selectedFilter();
    const q = this.searchText().trim().toLowerCase();

    return items.filter(item => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q);

      const matchFilter =
        filter === 'ALL' ||
        (filter === 'VEG' && item.veg) ||
        (filter === 'NON_VEG' && !item.veg);

      return matchSearch && matchFilter;
    });
  });

  visibleCoupon = computed(() => {
    const list = this.coupons();
    if (!list.length) return null;
    return list[this.currentCouponIndex()] ?? null;
  });

  bestCouponId = computed(() => {
    const list = this.coupons();
    if (!list.length) return null;

    const best = [...list].sort((a, b) => this.getCouponRankScore(b) - this.getCouponRankScore(a))[0];
    return best?.id ?? null;
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.svc.getAll().subscribe(list => {
      this.restaurant.set(list.find(r => r.id === id) || null);
    });

    this.svc.getPublicMenu(id).subscribe({
      next: (data) => {
        this.menuItems.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.loadCoupons(id);
  }

  ngAfterViewInit() {
    const imageEl = document.getElementById('imagePreviewModal');
    if (imageEl) {
      this.imageModalEl = imageEl;
      this.previewModal = bootstrap.Modal.getOrCreateInstance(imageEl);

      imageEl.addEventListener('hide.bs.modal', this.handleModalHide);
      imageEl.addEventListener('hidden.bs.modal', this.handleImageModalHidden);
    }

    const couponEl = document.getElementById('couponDetailsModal');
    if (couponEl) {
      this.couponModalEl = couponEl;
      this.couponDetailsModal = bootstrap.Modal.getOrCreateInstance(couponEl);

      couponEl.addEventListener('show.bs.modal', this.handleCouponModalShow);
      couponEl.addEventListener('shown.bs.modal', this.handleCouponModalShown);
      couponEl.addEventListener('hide.bs.modal', this.handleModalHide);
      couponEl.addEventListener('hidden.bs.modal', this.handleCouponModalHidden);
    }
  }

  ngOnDestroy(): void {
    this.stopCouponAutoSlide();

    if (this.copyResetTimeout) {
      clearTimeout(this.copyResetTimeout);
    }

    if (this.couponModalEl) {
      this.couponModalEl.removeEventListener('show.bs.modal', this.handleCouponModalShow);
      this.couponModalEl.removeEventListener('shown.bs.modal', this.handleCouponModalShown);
      this.couponModalEl.removeEventListener('hide.bs.modal', this.handleModalHide);
      this.couponModalEl.removeEventListener('hidden.bs.modal', this.handleCouponModalHidden);
    }

    if (this.imageModalEl) {
      this.imageModalEl.removeEventListener('hide.bs.modal', this.handleModalHide);
      this.imageModalEl.removeEventListener('hidden.bs.modal', this.handleImageModalHidden);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.showScrollTop.set(window.scrollY > 300);
  }

  private handleCouponModalShow = () => {
    this.blurActiveElement();
  };

  private handleCouponModalShown = () => {
    this.pauseCouponAutoSlide();
  };

  private handleCouponModalHidden = () => {
    this.blurActiveElement();
    this.resumeCouponAutoSlide();
  };

  private handleImageModalHidden = () => {
    this.blurActiveElement();
  };

  private handleModalHide = (event: Event) => {
    const modalElement = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;

    if (modalElement && activeElement && modalElement.contains(activeElement)) {
      activeElement.blur();
    } else {
      this.blurActiveElement();
    }
  };

  loadCoupons(restaurantId: number): void {
    forkJoin({
      restaurantCoupons: this.couponService.getRestaurantCoupons(restaurantId),
      globalCoupons: this.couponService.getGlobalCoupons()
    }).subscribe({
      next: ({ restaurantCoupons, globalCoupons }) => {
        const merged = [...restaurantCoupons, ...globalCoupons];
        const uniqueCoupons = merged.filter(
          (coupon, index, arr) => index === arr.findIndex(c => c.id === coupon.id)
        );

        const validCoupons = uniqueCoupons
          .filter(coupon => this.isCouponDisplayable(coupon))
          .sort((a, b) => this.getCouponRankScore(b) - this.getCouponRankScore(a));

        this.coupons.set(validCoupons);
        this.currentCouponIndex.set(0);

        if (validCoupons.length > 1) {
          this.startCouponAutoSlide();
        }
      },
      error: (error) => {
        console.error('Failed to load coupons', error);
        this.coupons.set([]);
      }
    });
  }

  isCouponDisplayable(coupon: Coupon): boolean {
    if (!coupon.active) return false;
    if (!coupon.expiryDate) return true;
    return new Date(coupon.expiryDate).getTime() >= new Date().setHours(0, 0, 0, 0);
  }

  getCouponRankScore(coupon: Coupon): number {
    if (coupon.discountType === 'FREE_DELIVERY') return 60;
    if (coupon.discountType === 'FLAT') return Number(coupon.discountValue) || 0;

    const percentageValue = Number(coupon.discountValue) || 0;
    const maxCap = Number(coupon.maxDiscountAmount || 0);
    return maxCap > 0 ? maxCap + percentageValue : percentageValue;
  }

  startCouponAutoSlide(): void {
    this.stopCouponAutoSlide();

    if (this.isCouponPaused || this.coupons().length <= 1) {
      return;
    }

    this.couponInterval = setInterval(() => {
      this.nextCoupon();
    }, 2200);
  }

  stopCouponAutoSlide(): void {
    if (this.couponInterval) {
      clearInterval(this.couponInterval);
      this.couponInterval = null;
    }
  }

  pauseCouponAutoSlide(): void {
    this.isCouponPaused = true;
    this.stopCouponAutoSlide();
  }

  resumeCouponAutoSlide(): void {
    this.isCouponPaused = false;
    this.startCouponAutoSlide();
  }

  nextCoupon(): void {
    const list = this.coupons();
    if (!list.length) return;
    this.currentCouponIndex.set((this.currentCouponIndex() + 1) % list.length);
  }

  prevCoupon(): void {
    const list = this.coupons();
    if (!list.length) return;
    this.currentCouponIndex.set((this.currentCouponIndex() - 1 + list.length) % list.length);
  }

  openCouponModal(coupon: Coupon): void {
    this.selectedCoupon.set(coupon);
    this.pauseCouponAutoSlide();
    this.blurActiveElement();

    setTimeout(() => {
      this.couponDetailsModal?.show();
    }, 0);
  }

  async copyCouponCode(code: string, couponId: number, event?: Event): Promise<void> {
    event?.stopPropagation();

    try {
      await navigator.clipboard.writeText(code);
      this.copiedCouponId.set(couponId);

      if (this.copyResetTimeout) {
        clearTimeout(this.copyResetTimeout);
      }

      this.copyResetTimeout = setTimeout(() => {
        this.copiedCouponId.set(null);
      }, 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }

  onSearch(value: string) {
    this.searchText.set(value);
  }

  setFilter(filter: FilterType) {
    this.selectedFilter.set(filter);
  }

  openImagePreview(image: string | null | undefined, title: string) {
    if (!image) return;
    this.previewImage.set(image);
    this.previewTitle.set(title);
    this.blurActiveElement();
    this.previewModal?.show();
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addToCart(item: MenuItem) {
    this.cartService.addToCart(item, this.restaurant());
  }

  removeFromCart(itemId: number) {
    this.cartService.removeFromCart(itemId);
  }

  increaseQty(itemId: number) {
    this.cartService.increaseQty(itemId);
  }

  decreaseQty(itemId: number) {
    this.cartService.decreaseQty(itemId);
  }

  getItemQty(itemId: number): number {
    const found = this.cartService.cart().find(c => c.item.id === itemId);
    return found ? found.qty : 0;
  }

  goToCheckout() {
    if (this.cartService.cart().length === 0) return;
    this.router.navigate(['/home/checkout']);
  }

  getCouponTypeLabel(coupon: Coupon): string {
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

  getCouponMinOrderText(coupon: Coupon): string {
    return `Minimum order amount ₹${coupon.minOrderAmount}`;
  }

  getCouponMaxDiscountText(coupon: Coupon): string {
    if (coupon.discountType !== 'PERCENTAGE' || !coupon.maxDiscountAmount) {
      return '';
    }
    return `Maximum discount ₹${coupon.maxDiscountAmount}`;
  }

  getCouponExpiryText(coupon: Coupon): string {
    if (!coupon.expiryDate) return 'Limited period offer';
    const date = new Date(coupon.expiryDate);
    return `Offer valid till ${date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
  }

  blurActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  }
}