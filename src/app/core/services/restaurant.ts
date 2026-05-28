import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// restaurant.service.ts

export interface Restaurant {
  id?: number;
  name: string;
  location: string;
  cuisine: string;
  rating?: number;
  deliveryTime?: number;
  isActive?: boolean;
}


export interface MenuItem {
  id?: number;
  name: string;
  price: number;
  veg: boolean;
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
  getMenu(id: number, veg?: boolean): Observable<MenuItem[]> {
    let params = new HttpParams();
    if (veg !== undefined) params = params.set('veg', String(veg));
    return this.http.get<MenuItem[]>(`${this.pub}/${id}/menu`, { params });
  }
  create(r: Restaurant) { 
    return this.http.post<Restaurant>(this.admin, r); 
  }

  update(id: number, r: Restaurant) {
     return this.http.put<Restaurant>(`${this.admin}/${id}`, r); 
    }

  delete(id: number) { 
    return this.http.delete<void>(`${this.admin}/${id}`); 
  }

  addMenuItem(rid: number, item: MenuItem) { 
    return this.http.post<MenuItem>(`${this.admin}/${rid}/menu-items`, item);
   }

  updateMenuItem(iid: number, item: MenuItem) { 
    return this.http.put<MenuItem>(`${this.admin}/menu-items/${iid}`, item); 
  }

  deleteMenuItem(iid: number) { 
    return this.http.delete<void>(`${this.admin}/menu-items/${iid}`);
   }
}