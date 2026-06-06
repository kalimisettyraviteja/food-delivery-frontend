import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RestaurantService, MenuItem, Restaurant } from '../../core/services/restaurant';
import { CartService } from '../../core/services/cart';

type FilterType = 'ALL' | 'VEG' | 'NON_VEG';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.html',
  styleUrl: './restaurant-detail.css'
})
export class RestaurantDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(RestaurantService);
  private router = inject(Router);

  cartService = inject(CartService);

  restaurant = signal<Restaurant | null>(null);
  menuItems = signal<MenuItem[]>([]);
  loading = signal(true);
  userName = localStorage.getItem('userName') || '';

  selectedFilter = signal<FilterType>('ALL');

  filteredMenuItems = computed(() => {
    const items = this.menuItems();
    const filter = this.selectedFilter();

    if (filter === 'VEG') {
      return items.filter(item => item.veg);
    }

    if (filter === 'NON_VEG') {
      return items.filter(item => !item.veg);
    }

    return items;
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.svc.getAll().subscribe(list => {
      this.restaurant.set(list.find(r => r.id === id) || null);
    });

    this.svc.getMenu(id).subscribe({
      next: (data) => {
        this.menuItems.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
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

  setFilter(filter: FilterType) {
    this.selectedFilter.set(filter);
  }

  goToCheckout() {
    if (this.cartService.cart().length === 0) return;
    this.router.navigate(['/checkout']);
  }
}