import { Injectable, computed, signal } from '@angular/core';

export interface CartItem {
  item: any;
  qty: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_KEY = 'food_app_cart';
  private readonly RESTAURANT_ID_KEY = 'food_app_restaurant_id';
  private readonly RESTAURANT_NAME_KEY = 'food_app_restaurant_name';

  cart = signal<CartItem[]>([]);
  restaurantId = signal<number | null>(null);
  restaurantName = signal<string>('');

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
  }

  addToCart(item: any, restaurant: any) {
    if (!restaurant?.id) return;

    if (this.restaurantId() && this.restaurantId() !== restaurant.id) {
      const confirmSwitch = confirm(
        'Your cart contains items from another restaurant. Clear cart and add this item?'
      );

      if (!confirmSwitch) return;

      this.clearCart();
    }

    this.restaurantId.set(restaurant.id);
    this.restaurantName.set(restaurant.name);

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
    }

    this.saveCartToStorage();
  }

  removeFromCart(itemId: number) {
    const updated = this.cart().filter(c => c.item.id !== itemId);
    this.cart.set(updated);

    if (updated.length === 0) {
      this.restaurantId.set(null);
      this.restaurantName.set('');
    }

    this.saveCartToStorage();
  }

  clearCart() {
    this.cart.set([]);
    this.restaurantId.set(null);
    this.restaurantName.set('');

    localStorage.removeItem(this.CART_KEY);
    localStorage.removeItem(this.RESTAURANT_ID_KEY);
    localStorage.removeItem(this.RESTAURANT_NAME_KEY);
  }
}