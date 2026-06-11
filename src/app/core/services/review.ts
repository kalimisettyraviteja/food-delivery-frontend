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
  reviewText: string;
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
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/reviews';

  createReview(payload: CreateReviewRequest): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(this.apiUrl, payload);
  }

  getReviewByOrderId(orderId: number): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(`${this.apiUrl}/orders/${orderId}`);
  }

  getRestaurantReviews(restaurantId: number): Observable<ReviewResponse[]> {
    return this.http.get<ReviewResponse[]>(`${this.apiUrl}/restaurants/${restaurantId}`);
  }

  getRestaurantRatingSummary(restaurantId: number): Observable<RestaurantRatingSummaryResponse> {
    return this.http.get<RestaurantRatingSummaryResponse>(
      `${this.apiUrl}/restaurants/${restaurantId}/summary`
    );
  }
}