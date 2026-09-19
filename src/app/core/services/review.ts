import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CreateReviewRequest {
  orderId: number;
  rating: number;
  reviewText: string;
}

export interface ReviewResponse {
  id: number;
  orderId: number;
  restaurantId: number;
  userId: number;
  userEmail: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantRatingSummaryResponse {
  restaurantId: number;
  averageRating: number;
  ratingCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private readonly http = inject(HttpClient);

  /*
   * Customer review APIs:
   * POST /api/reviews
   * GET  /api/reviews/orders/{orderId}
   */
  private readonly localCustomerApiUrl = 'http://localhost:8080/api/reviews';
  private readonly customerApiUrl = 'https://api-gateway-ftbf.onrender.com/api/reviews';

  /*
   * Restaurant manager review APIs:
   * GET /api/manager/reviews?restaurantId={restaurantId}
   * GET /api/manager/reviews/summary?restaurantId={restaurantId}
   */
      private readonly localManagerApiUrl = 'http://localhost:8080/api/manager/reviews';
      private readonly managerApiUrl = 'https://api-gateway-ftbf.onrender.com/api/manager/reviews';

  // -----------------------------------------------
  // Customer review APIs
  // -----------------------------------------------

  createReview(
    payload: CreateReviewRequest
  ): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(
      this.customerApiUrl,
      payload
    );
  }

  getReviewByOrderId(
    orderId: number
  ): Observable<ReviewResponse | null> {
    return this.http.get<ReviewResponse | null>(
      `${this.customerApiUrl}/orders/${orderId}`
    );
  }

  // -----------------------------------------------
  // Restaurant manager review APIs
  // -----------------------------------------------

  getManagerRestaurantReviews(
    restaurantId: number
  ): Observable<ReviewResponse[]> {
    return this.http.get<ReviewResponse[]>(
      this.managerApiUrl,
      {
        params: {
          restaurantId: String(restaurantId)
        }
      }
    );
  }

  getManagerRestaurantRatingSummary(
    restaurantId: number
  ): Observable<RestaurantRatingSummaryResponse> {
    return this.http.get<RestaurantRatingSummaryResponse>(
      `${this.managerApiUrl}/summary`,
      {
        params: {
          restaurantId: String(restaurantId)
        }
      }
    );
  }
}