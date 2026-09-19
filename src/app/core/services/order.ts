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

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type CancelledBy =
  | 'USER'
  | 'ADMIN'
  | 'AI_BOT';

export interface PlaceOrderItemRequest {
  menuItemId: number;
  itemName: string;
  price: number;
  quantity: number;
}

export interface OrderDeliveryAddressRequest {
  addressId?: number | null;
  label?: string;
  customLabel?: string;
  receiverName?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export interface OrderRestaurantSnapshotRequest {
  location?: string | null;
  cuisine?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  estimatedMinutes?: number | null;
}

export interface PlaceOrderRequest {
  restaurantId: number;
  restaurantName: string;
  items: PlaceOrderItemRequest[];
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  deliveryAddress: OrderDeliveryAddressRequest;
  restaurantSnapshot?: OrderRestaurantSnapshotRequest | null;
  cookingInstructions?: string | null;
}

export interface OrderItemResponse {
  menuItemId: number;
  itemName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderDeliveryAddressResponse {
  addressId?: number | null;
  label?: string | null;
  customLabel?: string | null;
  receiverName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean | null;
}

export interface OrderSummaryResponse {
  id: number;
  restaurantName: string;
  restaurantLocation?: string | null;
  restaurantDistanceKm?: number | null;
  restaurantEstimatedMinutes?: number | null;
  preparationBufferMinutes?: number | null;
  finalEstimatedDeliveryMinutes?: number | null;
  estimatedDeliveryAt?: string | null;
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
  restaurantLocation?: string | null;
  restaurantCuisine?: string | null;
  restaurantImageUrl?: string | null;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  restaurantDistanceKm?: number | null;
  restaurantEstimatedMinutes?: number | null;
  preparationBufferMinutes?: number | null;
  finalEstimatedDeliveryMinutes?: number | null;
  estimatedDeliveryAt?: string | null;
  originalAmount: number;
  discountAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  cancelledBy?: CancelledBy | null;
  cancelledAt?: string | null;
  refundAmount?: number | null;
  createdAt: string;
  items: OrderItemResponse[];
  deliveryAddress: OrderDeliveryAddressResponse | null;
  cookingInstructions?: string | null;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface CancelOrderRequest {
  cancelledBy: CancelledBy;
  reason?: string | null;
}

export interface UpdateOrderAddressRequest {
  addressId?: number | null;
  label?: string;
  customLabel?: string;
  receiverName?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateOrderContactRequest {
  receiverName: string;
  phoneNumber: string;
}

export interface UpdateOrderInstructionsRequest {
  cookingInstructions: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);

  private readonly localUserApiUrl = 'http://localhost:8080/api/orders';
  private readonly localAdminApiUrl = 'http://localhost:8080/api/admin/orders';
  private readonly localManagerApiUrl = 'http://localhost:8080/api/manager/orders';

   private readonly userApiUrl = 'https://api-gateway-ftbf.onrender.com/api/orders';
  private readonly adminApiUrl = 'https://api-gateway-ftbf.onrender.com/api/admin/orders';
  private readonly managerApiUrl = 'https://api-gateway-ftbf.onrender.com/api/manager/orders';

  // -------------------------------------------------
  // Customer order APIs
  // -------------------------------------------------

  placeOrder(payload: PlaceOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.userApiUrl, payload);
  }

  getMyOrders(): Observable<OrderSummaryResponse[]> {
    return this.http.get<OrderSummaryResponse[]>(
      `${this.userApiUrl}/my`
    );
  }

  getOrderById(orderId: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(
      `${this.userApiUrl}/${orderId}`
    );
  }

  cancelOrder(
    orderId: number,
    payload: CancelOrderRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.userApiUrl}/${orderId}/cancel`,
      payload
    );
  }

  updateOrderAddress(
    orderId: number,
    payload: UpdateOrderAddressRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.userApiUrl}/${orderId}/address`,
      payload
    );
  }

  updateOrderContact(
    orderId: number,
    payload: UpdateOrderContactRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.userApiUrl}/${orderId}/contact`,
      payload
    );
  }

  updateOrderInstructions(
    orderId: number,
    payload: UpdateOrderInstructionsRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.userApiUrl}/${orderId}/instructions`,
      payload
    );
  }

  // -------------------------------------------------
  // Admin order APIs
  // -------------------------------------------------

  getAllOrders(): Observable<OrderSummaryResponse[]> {
    return this.http.get<OrderSummaryResponse[]>(
      this.adminApiUrl
    );
  }

  updateOrderStatus(
    orderId: number,
    payload: UpdateOrderStatusRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.adminApiUrl}/${orderId}/status`,
      payload
    );
  }

  // -------------------------------------------------
  // Restaurant manager order APIs
  // -------------------------------------------------

  getManagerOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(
      this.managerApiUrl
    );
  }

  getManagerOrderById(orderId: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(
      `${this.managerApiUrl}/${orderId}`
    );
  }

  updateManagerOrderStatus(
    orderId: number,
    payload: UpdateOrderStatusRequest
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.managerApiUrl}/${orderId}/status`,
      payload
    );
  }
}