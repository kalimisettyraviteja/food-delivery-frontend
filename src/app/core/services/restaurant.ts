import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Restaurant {
  id?: number;
  name: string;
  location: string;
  cuisine: string;
  rating?: number | null;
  ratingCount?: number | null;
  isActive?: boolean;
  isPureVeg?: boolean;
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  estimatedMinutes?: number | null;
  imageUrl?: string | null;
  managerId?: number | null;
}

export interface RestaurantSearchRequest {
  location?: string | null;
  cuisine?: string | null;
  pureVegOnly?: boolean | null;
  lat?: number | null;
  lng?: number | null;
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
  private manager = 'http://localhost:8080/api/manager';

  // ══════════════════════════════════════════════════════════
  // USER / PUBLIC APIs — RestaurantController (/api/restaurants)
  // No auth required, used on customer home & restaurant pages
  // ══════════════════════════════════════════════════════════

  /** POST /api/restaurants/search — public restaurant search/listing */
  searchRestaurants(req: RestaurantSearchRequest = {}): Observable<Restaurant[]> {
    return this.http.post<Restaurant[]>(`${this.pub}/search`, req);
  }

  /** GET /api/restaurants/{restaurantId} — public restaurant detail page */
  getById(id: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(`${this.pub}/${id}`);
  }

  /** GET /api/restaurants/{restaurantId}/menu — public menu (optional veg filter) */
  getPublicMenu(restaurantId: number, veg?: boolean): Observable<MenuItem[]> {
    const params: any = {};
    if (veg !== undefined) params.veg = String(veg);
    return this.http.get<MenuItem[]>(`${this.pub}/${restaurantId}/menu`, { params });
  }

  // ══════════════════════════════════════════════════════════
  // ADMIN APIs — AdminRestaurantController (/api/admin/restaurants)
  // Requires ADMIN role, used on admin restaurants management page
  // ══════════════════════════════════════════════════════════

  /** POST /api/admin/restaurants */
  create(r: Restaurant): Observable<Restaurant> {
    return this.http.post<Restaurant>(this.admin, r);
  }

  /** PUT /api/admin/restaurants/{id} */
  update(id: number, r: Restaurant): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.admin}/${id}`, r);
  }

  /** DELETE /api/admin/restaurants/{id} */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.admin}/${id}`);
  }

  /** GET /api/admin/restaurants — ALL restaurants (active + inactive), admin-only listing */
  getAllAdmin(): Observable<Restaurant[]> {
    return this.http.get<Restaurant[]>(this.admin);
  }

  /** PATCH /api/admin/restaurants/{id}/image (multipart) */
  uploadRestaurantImage(id: number, file: File): Observable<Restaurant> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<Restaurant>(`${this.admin}/${id}/image`, fd);
  }

  /** DELETE /api/admin/restaurants/{id}/image */
  deleteRestaurantImage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.admin}/${id}/image`);
  }

  /** GET /api/admin/restaurants/{restaurantId}/menu-items */
  getAdminMenuItems(restaurantId: number): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.admin}/${restaurantId}/menu-items`);
  }

  /** POST /api/admin/restaurants/{restaurantId}/menu-items */
  addMenuItem(restaurantId: number, item: MenuItem): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.admin}/${restaurantId}/menu-items`, item);
  }

  /** PUT /api/admin/restaurants/menu-items/{itemId} */
  updateMenuItem(itemId: number, item: MenuItem): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.admin}/menu-items/${itemId}`, item);
  }

  /** DELETE /api/admin/restaurants/menu-items/{itemId} */
  deleteMenuItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.admin}/menu-items/${itemId}`);
  }

  /** PATCH /api/admin/restaurants/menu-items/{itemId}/image (multipart) */
  uploadMenuItemImage(itemId: number, file: File): Observable<MenuItem> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<MenuItem>(`${this.admin}/menu-items/${itemId}/image`, fd);
  }

  /** DELETE /api/admin/restaurants/menu-items/{itemId}/image */
  deleteMenuItemImage(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.admin}/menu-items/${itemId}/image`);
  }

    // ══════════════════════════════════════════════════════════
  // MANAGER APIs — ManagerRestaurantController (/api/manager)
  // Requires RESTAURANT_MANAGER role, managerId auto-bound from JWT
  // Used on manager dashboard pages (own restaurants only)
  // ══════════════════════════════════════════════════════════

  /** GET /api/manager/restaurants/summary — dashboard counts */
  getMyRestaurantSummary(): Observable<{
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
  }> {
    return this.http.get<{
      totalCount: number;
      activeCount: number;
      inactiveCount: number;
    }>(`${this.manager}/restaurants/summary`);
  }

  /** GET /api/manager/restaurants?status=ACTIVE|INACTIVE — list owned restaurants */
  getManagerRestaurants(status?: 'ACTIVE' | 'INACTIVE'): Observable<Restaurant[]> {
    const url = `${this.manager}/restaurants`;

    if (!status) {
      return this.http.get<Restaurant[]>(url);
    }

    return this.http.get<Restaurant[]>(url, {
      params: { status }
    });
  }

  /** POST /api/manager/restaurants — creates restaurant auto-bound to logged-in manager */
  createAsManager(r: Restaurant): Observable<Restaurant> {
    return this.http.post<Restaurant>(`${this.manager}/restaurants`, r);
  }

  /** PUT /api/manager/restaurants/{id} */
  updateAsManager(id: number, r: Restaurant): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.manager}/restaurants/${id}`, r);
  }

  /** DELETE /api/manager/restaurants/{id} */
  deleteAsManager(id: number): Observable<void> {
    return this.http.delete<void>(`${this.manager}/restaurants/${id}`);
  }

  /** GET /api/manager/restaurants/{id} */
  getMyRestaurantById(id: number): Observable<Restaurant> {
    return this.http.get<Restaurant>(`${this.manager}/restaurants/${id}`);
  }

  /** PATCH /api/manager/restaurants/{id}/image (multipart) */
  uploadRestaurantImageAsManager(id: number, file: File): Observable<Restaurant> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<Restaurant>(`${this.manager}/restaurants/${id}/image`, fd);
  }

  /** DELETE /api/manager/restaurants/{id}/image */
  deleteRestaurantImageAsManager(id: number): Observable<void> {
    return this.http.delete<void>(`${this.manager}/restaurants/${id}/image`);
  }

  /** GET /api/manager/restaurants/{restaurantId}/menu-items */
  getManagerMenuItems(restaurantId: number): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.manager}/restaurants/${restaurantId}/menu-items`);
  }

  /** POST /api/manager/restaurants/{restaurantId}/menu-items */
  addMenuItemAsManager(restaurantId: number, item: MenuItem): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.manager}/restaurants/${restaurantId}/menu-items`, item);
  }

  /** PUT /api/manager/menu-items/{itemId} */
  updateMenuItemAsManager(itemId: number, item: MenuItem): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.manager}/menu-items/${itemId}`, item);
  }

  /** DELETE /api/manager/menu-items/{itemId} */
  deleteMenuItemAsManager(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.manager}/menu-items/${itemId}`);
  }

  /** PATCH /api/manager/menu-items/{itemId}/image (multipart) */
  uploadMenuItemImageAsManager(itemId: number, file: File): Observable<MenuItem> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.patch<MenuItem>(`${this.manager}/menu-items/${itemId}/image`, fd);
  }

  /** DELETE /api/manager/menu-items/{itemId}/image */
  deleteMenuItemImageAsManager(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.manager}/menu-items/${itemId}/image`);
  }
}