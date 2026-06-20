import { Component, OnInit, AfterViewInit, HostListener, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantService, MenuItem, Restaurant } from '../../../core/services/restaurant';
import { CartService } from '../../../core/services/cart';

declare var bootstrap: any;

type FilterType = 'ALL' | 'VEG' | 'NON_VEG';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-detail.html',
  styleUrl: './restaurant-detail.css'
})
export class RestaurantDetail implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private svc = inject(RestaurantService);
  private router = inject(Router);
  cartService = inject(CartService);

  restaurant = signal<Restaurant | null>(null);
  menuItems = signal<MenuItem[]>([]);
  loading = signal(true);

  selectedFilter = signal<FilterType>('ALL');
  searchText = signal('');
  previewImage = signal('');
  previewTitle = signal('');
  showScrollTop = signal(false);

  private previewModal: any;

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
  }

  ngAfterViewInit() {
    const el = document.getElementById('imagePreviewModal');
    if (el) this.previewModal = bootstrap.Modal.getOrCreateInstance(el);
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.showScrollTop.set(window.scrollY > 300);
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
}