import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Restaurant {
  id?: number;
  name: string;
  location: string;
  cuisine: string;
  rating?: number;
  ratingCount?: number;
  deliveryTime?: number;
  isActive?: boolean;
  image?: string | null;
}

export interface MenuItem {
  id?: number;
  restaurantId?: number;
  name: string;
  description?: string;
  price: number;
  veg: boolean;
  image?: string | null;
  isAvailable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private http = inject(HttpClient);

  private pub = 'http://localhost:8080/api/restaurants';
  private admin = 'http://localhost:8080/api/admin/restaurants';

  getAll(location?: string, cuisine?: string): Observable<Restaurant[]> {
    let params = new HttpParams();
    if (location) params = params.set('location', location);
    if (cuisine) params = params.set('cuisine', cuisine);
    return this.http.get<Restaurant[]>(this.pub, { params });
  }

  getPublicMenu(restaurantId: number, veg?: boolean): Observable<MenuItem[]> {
    let params = new HttpParams();
    if (veg !== undefined) params = params.set('veg', String(veg));
    return this.http.get<MenuItem[]>(`${this.pub}/${restaurantId}/menu`, { params });
  }

  getAdminMenuItems(restaurantId: number): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.admin}/${restaurantId}/menu-items`);
  }

  create(r: Restaurant) {
    return this.http.post<Restaurant>(this.admin, r);
  }

  update(id: number, r: Restaurant) {
    return this.http.put<Restaurant>(`${this.admin}/${id}`, r);
  }

  uploadRestaurantImage(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<Restaurant>(`${this.admin}/${id}/image`, fd);
  }

  deleteRestaurantImage(id: number) {
    return this.http.delete<void>(`${this.admin}/${id}/image`);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.admin}/${id}`);
  }

  addMenuItem(restaurantId: number, item: MenuItem) {
    return this.http.post<MenuItem>(`${this.admin}/${restaurantId}/menu-items`, item);
  }

  updateMenuItem(itemId: number, item: MenuItem) {
    return this.http.put<MenuItem>(`${this.admin}/menu-items/${itemId}`, item);
  }

  uploadMenuItemImage(itemId: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<MenuItem>(`${this.admin}/menu-items/${itemId}/image`, fd);
  }

  deleteMenuItemImage(itemId: number) {
    return this.http.delete<void>(`${this.admin}/menu-items/${itemId}/image`);
  }

  deleteMenuItem(itemId: number) {
    return this.http.delete<void>(`${this.admin}/menu-items/${itemId}`);
  }
}