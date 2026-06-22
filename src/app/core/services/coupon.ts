import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DiscountType = 'FLAT' | 'PERCENTAGE' | 'FREE_DELIVERY';
export type CouponScope = 'GLOBAL' | 'RESTAURANT';

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  scope: CouponScope;
  restaurantId?: number | null;
  active: boolean;
  expiryDate?: string | null;
}

export interface CouponPayload {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  scope: CouponScope;
  restaurantId?: number | null;
  active: boolean;
  expiryDate?: string | null;
}

export interface ApplyCouponRequest {
  couponCode: string;
  restaurantId: number;
  orderAmount: number;
}

export interface ApplyCouponResponse {
  couponCode: string;
  description: string;
  originalAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  finalAmount: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class CouponService {
  private http = inject(HttpClient);

  private userApiUrl = 'https://api-gateway-ftbf.onrender.com/api/coupons';
  private adminApiUrl = 'https://api-gateway-ftbf.onrender.com/api/admin/coupons';

  getGlobalCoupons(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(`${this.userApiUrl}/global`);
  }

  getRestaurantCoupons(restaurantId: number): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(`${this.userApiUrl}/restaurant/${restaurantId}`);
  }

  applyCoupon(payload: ApplyCouponRequest): Observable<ApplyCouponResponse> {
    return this.http.post<ApplyCouponResponse>(`${this.userApiUrl}/apply`, payload);
  }

  getAllCoupons(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(this.adminApiUrl);
  }

  createCoupon(payload: CouponPayload): Observable<Coupon> {
    return this.http.post<Coupon>(this.adminApiUrl, payload);
  }

  updateCoupon(id: number, payload: CouponPayload): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.adminApiUrl}/${id}`, payload);
  }

  deleteCoupon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminApiUrl}/${id}`);
  }
}