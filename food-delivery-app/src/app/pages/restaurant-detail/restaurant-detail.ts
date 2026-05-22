import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RestaurantService, MenuItem, Restaurant } from '../../core/services/restaurant';

@Component({
  selector: 'app-restaurant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './restaurant-detail.html',
  styleUrl: './restaurant-detail.css'
})
export class RestaurantDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(RestaurantService);

  restaurant = signal<Restaurant | null>(null);
  menuItems  = signal<MenuItem[]>([]);
  cart       = signal<{ item: MenuItem; qty: number }[]>([]);
  loading    = signal(true);
  userName   = localStorage.getItem('userName') || '';

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getAll().subscribe(list => {
      this.restaurant.set(list.find(r => r.id === id) || null);
    });
    this.svc.getMenu(id).subscribe({
      next: (data) => { this.menuItems.set(data); this.loading.set(false); },
      error: ()     => this.loading.set(false)
    });
  }

  addToCart(item: MenuItem) {
    const current = this.cart();
    const existing = current.find(c => c.item.id === item.id);
    if (existing) {
      this.cart.set(current.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      this.cart.set([...current, { item, qty: 1 }]);
    }
  }

  removeFromCart(itemId: number) {
    this.cart.set(this.cart().filter(c => c.item.id !== itemId));
  }

  get cartTotal() {
    return this.cart().reduce((sum, c) => sum + c.item.price * c.qty, 0);
  }

  get cartCount() {
    return this.cart().reduce((sum, c) => sum + c.qty, 0);
  }
}