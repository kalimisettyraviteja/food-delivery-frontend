import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PaymentMethod =
  | 'CASH_ON_DELIVERY'
  | 'PHONEPE'
  | 'GPAY'
  | 'PAYTM'
  | 'CARD'
  | 'UPI';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface PlaceOrderItemRequest {
  menuItemId: number;
  itemName: string;
  price: number;
  quantity: number;
}

export interface PlaceOrderRequest {
  restaurantId: number;
  restaurantName: string;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  items: PlaceOrderItemRequest[];
}

export interface OrderItemResponse {
  menuItemId: number;
  itemName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderSummaryResponse {
  id: number;
  restaurantName: string;
  totalAmount: number;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderResponse {
  id: number;
  userId: number;
  userEmail: string;
  restaurantId: number;
  restaurantName: string;
  originalAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemResponse[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);

  private userApiUrl = 'https://api-gateway-ftbf.onrender.com/api/orders';
  private adminApiUrl = 'https://api-gateway-ftbf.onrender.com/api/admin/orders';

  placeOrder(payload: PlaceOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.userApiUrl, payload);
  }

  getMyOrders(): Observable<OrderSummaryResponse[]> {
    return this.http.get<OrderSummaryResponse[]>(`${this.userApiUrl}/my`);
  }

  getOrderById(orderId: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.userApiUrl}/${orderId}`);
  }

  getAllOrders(): Observable<OrderSummaryResponse[]> {
    return this.http.get<OrderSummaryResponse[]>(this.adminApiUrl);
  }

  updateOrderStatus(orderId: number, payload: UpdateOrderStatusRequest): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.adminApiUrl}/${orderId}/status`, payload);
  }
}