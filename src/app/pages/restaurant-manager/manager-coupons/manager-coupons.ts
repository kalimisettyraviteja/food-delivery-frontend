import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Coupon,
  CouponPayload,
  CouponService,
  DiscountType
} from '../../../core/services/coupon';

@Component({
  selector: 'app-manager-coupons',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './manager-coupons.html',
  styleUrl: './manager-coupons.css'
})
export class ManagerCoupons implements OnInit {
  private readonly couponService = inject(CouponService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  loading = false;
  saving = false;
  deleting = false;

  errorMessage = '';
  successMessage = '';

  restaurantId: number | null = null;
  restaurantName = 'Restaurant';

  coupons: Coupon[] = [];
  filteredCoupons: Coupon[] = [];

  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  searchTerm = '';

  showCouponModal = false;
  editingCoupon: Coupon | null = null;
  couponToDelete: Coupon | null = null;

  couponForm: FormGroup = this.formBuilder.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
        Validators.pattern(/^[A-Za-z0-9_-]+$/)
      ]
    ],

    description: [
      '',
      [
        Validators.maxLength(180)
      ]
    ],

    discountType: [
      'FLAT',
      Validators.required
    ],

    discountValue: [
      0,
      [
        Validators.required,
        Validators.min(1)
      ]
    ],

    maxDiscountAmount: [
      null
    ],

    minOrderAmount: [
      0,
      [
        Validators.required,
        Validators.min(0)
      ]
    ],

    active: [
      true
    ],

    expiryDate: [
      null
    ]
  });

  get activeCount(): number {
    return this.coupons.filter(
      coupon => coupon.active
    ).length;
  }

  get inactiveCount(): number {
    return this.coupons.length - this.activeCount;
  }

  get isEditMode(): boolean {
    return this.editingCoupon !== null;
  }

  get selectedDiscountType(): DiscountType {
    return this.couponForm.get('discountType')
      ?.value as DiscountType;
  }

  get isFreeDelivery(): boolean {
    return this.selectedDiscountType === 'FREE_DELIVERY';
  }

  get isPercentage(): boolean {
    return this.selectedDiscountType === 'PERCENTAGE';
  }

  ngOnInit(): void {
    this.couponForm
      .get('discountType')
      ?.valueChanges
      .subscribe(() => {
        this.updateDiscountFieldValidation();
      });

    this.updateDiscountFieldValidation();

    this.route.queryParamMap.subscribe(params => {
      const restaurantIdParam = params.get('restaurantId');
      const restaurantNameParam = params.get('restaurantName');

      const parsedRestaurantId = Number(restaurantIdParam);

      if (
        !restaurantIdParam ||
        Number.isNaN(parsedRestaurantId) ||
        parsedRestaurantId <= 0
      ) {
        this.errorMessage =
          'Restaurant details are missing. Please open Coupons from My restaurants.';

        return;
      }

      this.restaurantId = parsedRestaurantId;

      this.restaurantName =
        restaurantNameParam?.trim() ||
        'Selected restaurant';

      this.loadCoupons();
    });
  }

  loadCoupons(): void {
    if (!this.restaurantId) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.couponService
      .getManagerCoupons(this.restaurantId)
      .subscribe({
        next: coupons => {
          this.coupons = coupons ?? [];
          this.applyFilters();
          this.loading = false;
        },

        error: err => {
          this.errorMessage =
            err?.error?.message ||
            'Unable to load coupons for this restaurant.';

          this.loading = false;
        }
      });
  }

  applyFilters(): void {
    const search = this.searchTerm
      .trim()
      .toLowerCase();

    this.filteredCoupons = this.coupons.filter(coupon => {
      const matchesSearch =
        !search ||
        [
          coupon.code,
          coupon.description,
          coupon.discountType
        ].some(value =>
          String(value ?? '')
            .toLowerCase()
            .includes(search)
        );

      const matchesStatus =
        this.statusFilter === 'ALL' ||
        (
          this.statusFilter === 'ACTIVE' &&
          coupon.active
        ) ||
        (
          this.statusFilter === 'INACTIVE' &&
          !coupon.active
        );

      return matchesSearch && matchesStatus;
    });
  }

  setStatusFilter(
    status: 'ALL' | 'ACTIVE' | 'INACTIVE'
  ): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  openCreateModal(): void {
    if (!this.restaurantId) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.editingCoupon = null;

    this.couponForm.reset({
      code: '',
      description: '',
      discountType: 'FLAT',
      discountValue: 0,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      active: true,
      expiryDate: null
    });

    this.updateDiscountFieldValidation();
    this.showCouponModal = true;
  }

  openEditModal(coupon: Coupon): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.editingCoupon = coupon;

    this.couponForm.reset({
      code: coupon.code,
      description: coupon.description ?? '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount ?? null,
      minOrderAmount: coupon.minOrderAmount,
      active: coupon.active,
      expiryDate: coupon.expiryDate ?? null
    });

    this.updateDiscountFieldValidation();
    this.showCouponModal = true;
  }

  closeCouponModal(): void {
    if (this.saving) {
      return;
    }

    this.showCouponModal = false;
    this.editingCoupon = null;
  }

  saveCoupon(): void {
    if (!this.restaurantId || this.saving) {
      return;
    }

    this.normalizeCouponCode();
    this.updateDiscountFieldValidation();

    if (this.couponForm.invalid) {
      this.couponForm.markAllAsTouched();
      return;
    }

    const payload = this.buildCouponPayload();

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      this.editingCoupon?.id
        ? this.couponService.updateManagerCoupon(
            this.editingCoupon.id,
            payload
          )
        : this.couponService.createManagerCoupon(payload);

    request$.subscribe({
      next: savedCoupon => {
        if (this.editingCoupon?.id) {
          this.coupons = this.coupons.map(coupon =>
            coupon.id === savedCoupon.id
              ? savedCoupon
              : coupon
          );

          this.successMessage =
            'Coupon updated successfully.';
        } else {
          this.coupons = [
            savedCoupon,
            ...this.coupons
          ];

          this.successMessage =
            'Coupon created successfully.';
        }

        this.applyFilters();

        this.saving = false;
        this.showCouponModal = false;
        this.editingCoupon = null;
      },

      error: err => {
        this.errorMessage =
          err?.error?.message ||
          'Unable to save coupon. Please try again.';

        this.saving = false;
      }
    });
  }

  toggleCouponStatus(coupon: Coupon): void {
    if (
      !coupon.id ||
      !this.restaurantId ||
      this.saving
    ) {
      return;
    }

    const payload: CouponPayload = {
      code: coupon.code,
      description: coupon.description ?? '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount:
        coupon.maxDiscountAmount ?? null,
      minOrderAmount: coupon.minOrderAmount,
      scope: 'RESTAURANT',
      restaurantId: this.restaurantId,
      active: !coupon.active,
      expiryDate: coupon.expiryDate ?? null
    };

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.couponService
      .updateManagerCoupon(coupon.id, payload)
      .subscribe({
        next: updatedCoupon => {
          this.coupons = this.coupons.map(item =>
            item.id === updatedCoupon.id
              ? updatedCoupon
              : item
          );

          this.applyFilters();
          this.saving = false;

          this.successMessage = updatedCoupon.active
            ? `${updatedCoupon.code} is now active.`
            : `${updatedCoupon.code} is now inactive.`;
        },

        error: err => {
          this.errorMessage =
            err?.error?.message ||
            'Unable to update coupon status.';

          this.saving = false;
        }
      });
  }

  askDelete(coupon: Coupon): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.couponToDelete = coupon;
  }

  cancelDelete(): void {
    if (!this.deleting) {
      this.couponToDelete = null;
    }
  }

  confirmDelete(): void {
    const couponId = this.couponToDelete?.id;

    if (!couponId || this.deleting) {
      return;
    }

    this.deleting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.couponService
      .deleteManagerCoupon(couponId)
      .subscribe({
        next: () => {
          this.coupons = this.coupons.filter(
            coupon => coupon.id !== couponId
          );

          this.applyFilters();

          this.couponToDelete = null;
          this.deleting = false;

          this.successMessage =
            'Coupon deleted successfully.';
        },

        error: err => {
          this.errorMessage =
            err?.error?.message ||
            'Unable to delete coupon.';

          this.deleting = false;
        }
      });
  }


  getDiscountLabel(coupon: Coupon): string {
    switch (coupon.discountType) {
      case 'PERCENTAGE':
        return `${coupon.discountValue}% off`;

      case 'FREE_DELIVERY':
        return 'Free delivery';

      default:
        return `₹${coupon.discountValue} off`;
    }
  }

  getCouponDescription(coupon: Coupon): string {
    if (coupon.description?.trim()) {
      return coupon.description;
    }

    if (coupon.discountType === 'FREE_DELIVERY') {
      return `Free delivery on orders above ₹${coupon.minOrderAmount}`;
    }

    return `${this.getDiscountLabel(coupon)} on orders above ₹${coupon.minOrderAmount}`;
  }

  getExpiryLabel(coupon: Coupon): string {
    if (!coupon.expiryDate) {
      return 'No expiry date';
    }

    const expiryDate = new Date(
      `${coupon.expiryDate}T00:00:00`
    );

    return `Expires ${expiryDate.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    )}`;
  }

  isExpired(coupon: Coupon): boolean {
    if (!coupon.expiryDate) {
      return false;
    }

    const expiryDate = new Date(
      `${coupon.expiryDate}T23:59:59`
    );

    return expiryDate.getTime() < Date.now();
  }

  trackByCouponId(
    _index: number,
    coupon: Coupon
  ): number {
    return coupon.id;
  }

  hasError(controlName: string): boolean {
    const control = this.couponForm.get(controlName);

    return Boolean(
      control &&
      control.invalid &&
      (control.touched || control.dirty)
    );
  }

  private buildCouponPayload(): CouponPayload {
    const formValue = this.couponForm.getRawValue();

    return {
      code: String(formValue.code)
        .trim()
        .toUpperCase(),

      description:
        String(formValue.description ?? '')
          .trim(),

      discountType:
        formValue.discountType as DiscountType,

      discountValue:
        formValue.discountType === 'FREE_DELIVERY'
          ? 0
          : Number(formValue.discountValue),

      maxDiscountAmount:
        formValue.discountType === 'PERCENTAGE' &&
        formValue.maxDiscountAmount !== null &&
        formValue.maxDiscountAmount !== ''
          ? Number(formValue.maxDiscountAmount)
          : null,

      minOrderAmount: Number(formValue.minOrderAmount),

      scope: 'RESTAURANT',

      restaurantId: this.restaurantId as number,

      active: Boolean(formValue.active),

      expiryDate: formValue.expiryDate || null
    };
  }

  private normalizeCouponCode(): void {
    const codeControl = this.couponForm.get('code');

    if (!codeControl) {
      return;
    }

    const normalizedCouponCode = String(
      codeControl.value ?? ''
    )
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    codeControl.setValue(
      normalizedCouponCode,
      {
        emitEvent: false
      }
    );
  }

  private updateDiscountFieldValidation(): void {
    const discountValueControl =
      this.couponForm.get('discountValue');

    const maxDiscountAmountControl =
      this.couponForm.get('maxDiscountAmount');

    if (
      !discountValueControl ||
      !maxDiscountAmountControl
    ) {
      return;
    }

    if (this.selectedDiscountType === 'FREE_DELIVERY') {
      discountValueControl.clearValidators();

      discountValueControl.setValue(
        0,
        {
          emitEvent: false
        }
      );

      maxDiscountAmountControl.clearValidators();

      maxDiscountAmountControl.setValue(
        null,
        {
          emitEvent: false
        }
      );
    } else {
      discountValueControl.setValidators([
        Validators.required,
        Validators.min(1)
      ]);

      if (this.selectedDiscountType === 'PERCENTAGE') {
        maxDiscountAmountControl.setValidators([
          Validators.min(1)
        ]);
      } else {
        maxDiscountAmountControl.clearValidators();

        maxDiscountAmountControl.setValue(
          null,
          {
            emitEvent: false
          }
        );
      }
    }

    discountValueControl.updateValueAndValidity({
      emitEvent: false
    });

    maxDiscountAmountControl.updateValueAndValidity({
      emitEvent: false
    });
  }
}