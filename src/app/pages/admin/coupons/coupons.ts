import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Coupon,
  CouponPayload,
  CouponScope,
  CouponService,
  DiscountType
} from '../../../core/services/coupon';
import { RestaurantService } from '../../../core/services/restaurant';

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coupons.html',
  styleUrl: './coupons.css'
})
export class Coupons implements OnInit {
  private couponService = inject(CouponService);
  private restaurantService = inject(RestaurantService);

  coupons: Coupon[] = [];
  restaurants: any[] = [];
  loading = false;
  submitting = false;
  error = '';
  success = '';
  editingCouponId: number | null = null;

  discountTypes: DiscountType[] = ['FLAT', 'PERCENTAGE', 'FREE_DELIVERY'];
  scopes: CouponScope[] = ['GLOBAL', 'RESTAURANT'];

  form: CouponPayload = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    maxDiscountAmount: null,
    minOrderAmount: 0,
    scope: 'GLOBAL',
    restaurantId: null,
    active: true,
    expiryDate: null
  };

  ngOnInit(): void {
    this.loadCoupons();
    this.loadRestaurants();
  }

  loadCoupons(): void {
    this.loading = true;
    this.error = '';

    this.couponService.getAllCoupons().subscribe({
      next: (data) => {
        this.coupons = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load coupons';
        this.loading = false;
      }
    });
  }

  loadRestaurants(): void {
    this.restaurantService.getAll().subscribe({
      next: (data: any[]) => {
        this.restaurants = data;
      },
      error: () => {
        console.error('Failed to load restaurants');
      }
    });
  }

  getRestaurantName(restaurantId: number | null | undefined): string {
    if (!restaurantId) return '-';
    const restaurant = this.restaurants.find(r => r.id === restaurantId);
    return restaurant ? restaurant.name : `Restaurant #${restaurantId}`;
  }

  saveCoupon(): void {
    this.error = '';
    this.success = '';

    if (!this.form.code?.trim() ||
        !this.form.description?.trim() ||
        !this.form.discountType ||
        !this.form.scope ||
        this.form.discountValue === null ||
        this.form.discountValue === undefined ||
        this.form.minOrderAmount === null ||
        this.form.minOrderAmount === undefined ||
        !this.form.expiryDate ||
        (this.form.scope === 'RESTAURANT' && !this.form.restaurantId) ||
        (this.form.discountType === 'PERCENTAGE' && (this.form.maxDiscountAmount === null || this.form.maxDiscountAmount === undefined))) {
      this.error = 'Please fill all mandatory fields correctly.';
      return;
    }

    const payload: CouponPayload = {
      ...this.form,
      code: this.form.code.trim().toUpperCase(),
      description: this.form.description.trim(),
      restaurantId: this.form.scope === 'RESTAURANT' ? this.form.restaurantId : null,
      maxDiscountAmount: this.form.discountType === 'PERCENTAGE' ? this.form.maxDiscountAmount : null,
      discountValue: this.form.discountType === 'FREE_DELIVERY' ? 0 : this.form.discountValue
    };

    this.submitting = true;

    const request$ = this.editingCouponId
      ? this.couponService.updateCoupon(this.editingCouponId, payload)
      : this.couponService.createCoupon(payload);

    request$.subscribe({
      next: () => {
        this.success = this.editingCouponId
          ? 'Coupon updated successfully'
          : 'Coupon created successfully';
        this.resetForm();
        this.loadCoupons();
        this.submitting = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to save coupon';
        this.submitting = false;
      }
    });
  }

  editCoupon(coupon: Coupon): void {
    this.editingCouponId = coupon.id;
    this.error = '';
    this.success = '';

    this.form = {
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountType === 'FREE_DELIVERY' ? 0 : coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount ?? null,
      minOrderAmount: coupon.minOrderAmount,
      scope: coupon.scope,
      restaurantId: coupon.restaurantId ?? null,
      active: coupon.active,
      expiryDate: coupon.expiryDate ?? null
    };
  }

  deleteCoupon(id: number): void {
    const confirmed = confirm('Are you sure you want to delete this coupon?');
    if (!confirmed) return;

    this.error = '';
    this.success = '';

    this.couponService.deleteCoupon(id).subscribe({
      next: () => {
        this.success = 'Coupon deleted successfully';
        if (this.editingCouponId === id) {
          this.resetForm();
        }
        this.loadCoupons();
      },
      error: () => {
        this.error = 'Failed to delete coupon';
      }
    });
  }

  resetForm(): void {
    this.editingCouponId = null;
    this.form = {
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 0,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      scope: 'GLOBAL',
      restaurantId: null,
      active: true,
      expiryDate: null
    };
  }
}