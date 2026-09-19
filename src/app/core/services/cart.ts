import { Injectable, computed, signal } from '@angular/core';
import { MenuItem, Restaurant } from './restaurant';

export interface CartItem {
  item: MenuItem;
  qty: number;
}

export interface CartRestaurantSnapshot {
  id: number;
  name: string;
  location?: string | null;
  cuisine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  estimatedMinutes?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_KEY = 'food_app_cart';
  private readonly RESTAURANT_ID_KEY = 'food_app_restaurant_id';
  private readonly RESTAURANT_NAME_KEY = 'food_app_restaurant_name';
  private readonly RESTAURANT_SNAPSHOT_KEY = 'food_app_restaurant_snapshot';

  cart = signal<CartItem[]>([]);
  restaurantId = signal<number | null>(null);
  restaurantName = signal<string>('');
  restaurantSnapshot = signal<CartRestaurantSnapshot | null>(null);

  cartCount = computed(() =>
    this.cart().reduce((total, c) => total + c.qty, 0)
  );

  cartTotal = computed(() =>
    this.cart().reduce((total, c) => total + (c.item.price * c.qty), 0)
  );

  constructor() {
    this.loadCartFromStorage();
  }

  private loadCartFromStorage() {
    const savedCart = localStorage.getItem(this.CART_KEY);
    const savedRestaurantId = localStorage.getItem(this.RESTAURANT_ID_KEY);
    const savedRestaurantName = localStorage.getItem(this.RESTAURANT_NAME_KEY);
    const savedRestaurantSnapshot = localStorage.getItem(this.RESTAURANT_SNAPSHOT_KEY);

    if (savedCart) {
      try {
        this.cart.set(JSON.parse(savedCart));
      } catch {
        this.cart.set([]);
      }
    }

    if (savedRestaurantId) {
      this.restaurantId.set(Number(savedRestaurantId));
    }

    if (savedRestaurantName) {
      this.restaurantName.set(savedRestaurantName);
    }

    if (savedRestaurantSnapshot) {
      try {
        this.restaurantSnapshot.set(JSON.parse(savedRestaurantSnapshot) as CartRestaurantSnapshot);
      } catch {
        this.restaurantSnapshot.set(null);
        localStorage.removeItem(this.RESTAURANT_SNAPSHOT_KEY);
      }
    }
  }

  private saveCartToStorage() {
    localStorage.setItem(this.CART_KEY, JSON.stringify(this.cart()));

    if (this.restaurantId() !== null) {
      localStorage.setItem(this.RESTAURANT_ID_KEY, String(this.restaurantId()));
    } else {
      localStorage.removeItem(this.RESTAURANT_ID_KEY);
    }

    if (this.restaurantName()) {
      localStorage.setItem(this.RESTAURANT_NAME_KEY, this.restaurantName());
    } else {
      localStorage.removeItem(this.RESTAURANT_NAME_KEY);
    }

    if (this.restaurantSnapshot()) {
      localStorage.setItem(this.RESTAURANT_SNAPSHOT_KEY, JSON.stringify(this.restaurantSnapshot()));
    } else {
      localStorage.removeItem(this.RESTAURANT_SNAPSHOT_KEY);
    }
  }

 private buildRestaurantSnapshot(restaurant: Restaurant): CartRestaurantSnapshot {
  return {
    id: restaurant.id!,
    name: restaurant.name,
    location: restaurant.location ?? '',
    cuisine: restaurant.cuisine ?? '',
    latitude: restaurant.latitude ?? null,
    longitude: restaurant.longitude ?? null,
    distanceKm: restaurant.distanceKm ?? null,
    estimatedMinutes: restaurant.estimatedMinutes ?? null
  };
}

  addToCart(item: MenuItem, restaurant: Restaurant | null) {
    if (!restaurant?.id) return;

    if (this.restaurantId() && this.restaurantId() !== restaurant.id) {
      const confirmSwitch = confirm(
        'Your cart contains items from another restaurant. Clear cart and add this item?'
      );

      if (!confirmSwitch) return;

      this.clearCart();
    }

    const snapshot = this.buildRestaurantSnapshot(restaurant);

    this.restaurantId.set(restaurant.id);
    this.restaurantName.set(restaurant.name);
    this.restaurantSnapshot.set(snapshot);

    const existing = this.cart().find(c => c.item.id === item.id);

    if (existing) {
      this.cart.set(
        this.cart().map(c =>
          c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c
        )
      );
    } else {
      this.cart.set([...this.cart(), { item, qty: 1 }]);
    }

    this.saveCartToStorage();
  }

  increaseQty(itemId: number) {
    this.cart.set(
      this.cart().map(c =>
        c.item.id === itemId ? { ...c, qty: c.qty + 1 } : c
      )
    );
    this.saveCartToStorage();
  }

  decreaseQty(itemId: number) {
    const updated = this.cart()
      .map(c =>
        c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c
      )
      .filter(c => c.qty > 0);

    this.cart.set(updated);

    if (updated.length === 0) {
      this.restaurantId.set(null);
      this.restaurantName.set('');
      this.restaurantSnapshot.set(null);
    }

    this.saveCartToStorage();
  }

  removeFromCart(itemId: number) {
    const updated = this.cart().filter(c => c.item.id !== itemId);
    this.cart.set(updated);

    if (updated.length === 0) {
      this.restaurantId.set(null);
      this.restaurantName.set('');
      this.restaurantSnapshot.set(null);
    }

    this.saveCartToStorage();
  }

  clearCart() {
    this.cart.set([]);
    this.restaurantId.set(null);
    this.restaurantName.set('');
    this.restaurantSnapshot.set(null);

    localStorage.removeItem(this.CART_KEY);
    localStorage.removeItem(this.RESTAURANT_ID_KEY);
    localStorage.removeItem(this.RESTAURANT_NAME_KEY);
    localStorage.removeItem(this.RESTAURANT_SNAPSHOT_KEY);
  }
}