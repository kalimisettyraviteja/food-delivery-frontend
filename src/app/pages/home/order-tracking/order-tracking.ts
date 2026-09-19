import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import * as L from 'leaflet';
import { ActivatedRoute } from '@angular/router';
import {
  CancelledBy,
  OrderResponse,
  OrderService,
  OrderStatus,
  UpdateOrderContactRequest,
  UpdateOrderInstructionsRequest
} from '../../../core/services/order';
import { Router } from '@angular/router';
import { AddressResponse, UserService } from '../../../core/services/user';

type TrackingStep = {
  key: OrderStatus;
  label: string;
};

type ToastType = 'success' | 'info' | 'warning' | 'error';

type ToastData = {
  message: string;
  type: ToastType;
};

const EDITABLE_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED'];

const TERMINAL_STATUSES: OrderStatus[] = [
  'DELIVERED',
  'CANCELLED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY'
];

const ADDRESS_DROPDOWN_LIMIT = 3;
const ADDRESS_DELTA_BUFFER_KM = 2;
const MAX_DELIVERY_DISTANCE_KM = 15;
const COOKING_INSTRUCTIONS_MAX_LENGTH = 500;
const COOKING_INSTRUCTIONS_MIN_LENGTH = 5;

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.css'
})
export class OrderTracking implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private userService = inject(UserService);

  @ViewChild('trackingMap') trackingMapRef?: ElementRef<HTMLDivElement>;

  orderId = Number(this.route.snapshot.paramMap.get('orderId'));

  loading = signal(true);
  errorMessage = signal('');
  order = signal<OrderResponse | null>(null);
  nowTick = signal(Date.now());
  toast = signal<ToastData | null>(null);

  cancellingOrder = signal(false);

  savingUpdatedAddress = signal(false);
  loadingSavedAddresses = signal(false);
  savedAddressList = signal<AddressResponse[]>([]);
  showAllSavedAddresses = signal(false);
  selectedAddressId = signal<number | null>(null);

  savingUpdatedContact = signal(false);
  updatedReceiverName = signal('');
  updatedPhoneNumber = signal('');

  savingUpdatedInstructions = signal(false);
  updatedCookingInstructions = signal('');

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private viewReady = false;
  private map: L.Map | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private allowedBounds: L.LatLngBounds | null = null;

  trackingSteps: TrackingStep[] = [
    { key: 'PLACED', label: 'Placed' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'OUT_FOR_DELIVERY', label: 'On the way' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  cookingInstructionsMaxLength = COOKING_INSTRUCTIONS_MAX_LENGTH;

  currentStepIndex = computed(() => {
    const currentStatus = this.order()?.status;

    if (!currentStatus) {
      return 0;
    }

    const index = this.trackingSteps.findIndex(
      step => step.key === currentStatus
    );

    if (index >= 0) {
      return index;
    }

    if (currentStatus === 'PICKED_UP') {
      return 3;
    }

    if (currentStatus === 'CANCELLED') {
      return -1;
    }

    return 0;
  });

  estimatedDeliveryText = computed(() => {
    const order = this.order();
    this.nowTick();

    if (!order) {
      return 'Calculating ETA';
    }

    if (order.status === 'DELIVERED') {
      return 'Delivered';
    }

    if (order.status === 'CANCELLED') {
      return 'Cancelled';
    }

    let arrivalTimeMs: number | null = null;

    if (order.estimatedDeliveryAt) {
      arrivalTimeMs = new Date(order.estimatedDeliveryAt).getTime();
    } else if (order.finalEstimatedDeliveryMinutes != null) {
      arrivalTimeMs =
        new Date(order.createdAt).getTime() +
        order.finalEstimatedDeliveryMinutes * 60000;
    }

    if (arrivalTimeMs == null) {
      return 'ETA updating';
    }

    const remainingMinutes = Math.ceil(
      (arrivalTimeMs - Date.now()) / 60000
    );

    if (remainingMinutes <= 1) {
      return 'Arriving shortly';
    }

    return `Arriving in ${remainingMinutes} mins`;
  });

  isOrderActive = computed(() => {
    const status = this.order()?.status;
    return !!status && !TERMINAL_STATUSES.includes(status);
  });

  isPrePreparing = computed(() => {
    const status = this.order()?.status;
    return !!status && EDITABLE_STATUSES.includes(status);
  });

  canEditAddress = computed(() => this.isPrePreparing());

  canEditContact = computed(() => this.isPrePreparing());

  hasCookingInstructions = computed(() => {
    return !!this.order()?.cookingInstructions?.trim();
  });

  canEditInstructions = computed(() => {
    return this.isPrePreparing() && !this.hasCookingInstructions();
  });

  canSendInstructions = computed(() => {
    return (
      this.updatedCookingInstructions().trim().length >=
      COOKING_INSTRUCTIONS_MIN_LENGTH
    );
  });

  canCancelOrder = computed(() => this.isOrderActive());

  cancelRefundNote = computed(() =>
    this.isPrePreparing()
      ? 'Free cancellation — no charges will apply.'
      : 'Order is already being prepared. Cancelling now will not be refunded.'
  );

  cancelRefundEligible = computed(() => this.isPrePreparing());

  cancelRefundAmount = computed(() => {
    const order = this.order();

    if (!order) {
      return 0;
    }

    return this.cancelRefundEligible() && order.paymentStatus === 'PAID'
      ? order.totalAmount
      : 0;
  });

  visibleSavedAddresses = computed(() => {
    const allAddresses = this.savedAddressList();

    return this.showAllSavedAddresses()
      ? allAddresses
      : allAddresses.slice(0, ADDRESS_DROPDOWN_LIMIT);
  });

  hasMoreSavedAddresses = computed(() => {
    return (
      this.savedAddressList().length > ADDRESS_DROPDOWN_LIMIT &&
      !this.showAllSavedAddresses()
    );
  });

  ngOnInit(): void {
    if (!this.orderId || Number.isNaN(this.orderId)) {
      this.loading.set(false);
      this.errorMessage.set('Invalid order id.');
      return;
    }

    this.loadOrder(true);
    this.startAutoRefresh();
    this.startClockTick();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryRenderRouteMap();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.destroyMap();
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.loadOrder(false);
    }, 25000);
  }

  private startClockTick(): void {
    this.clockTimer = setInterval(() => {
      this.nowTick.set(Date.now());
    }, 30000);
  }

  showToast(message: string, type: ToastType = 'info'): void {
    this.toast.set({ message, type });

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toast.set(null);
    }, 2600);
  }

  goBack(): void {
        this.router.navigate(['/home/main']);

  }

  loadOrder(showLoader = true): void {
    if (showLoader) {
      this.loading.set(true);
      this.errorMessage.set('');
    }

    this.orderService.getOrderById(this.orderId).subscribe({
      next: (res) => {
        this.order.set(res);
        this.loading.set(false);
        this.errorMessage.set('');

        this.tryRenderRouteMap();
      },
      error: (err) => {
        if (showLoader) {
          this.loading.set(false);
          this.errorMessage.set(
            err?.error?.message ||
            'Unable to load order tracking details.'
          );
        }
      }
    });
  }

  refreshTrackingNow(): void {
    this.nowTick.set(Date.now());
    this.loadOrder(false);
    this.showToast('Tracking refreshed', 'success');
  }

  hasRouteMapData(): boolean {
    const order = this.order();
    const address = order?.deliveryAddress;

    return !!(
      order?.restaurantLatitude != null &&
      order.restaurantLongitude != null &&
      address?.latitude != null &&
      address.longitude != null
    );
  }

  /*
   * Important:
   * `#trackingMap` is inside an *ngIf.
   * Angular creates that element only after `loading` becomes false
   * and `order` is available.
   *
   * Two requestAnimationFrame calls wait for:
   * 1. Angular to render the element.
   * 2. Browser to calculate its final height and width.
   */
  private tryRenderRouteMap(): void {
    if (!this.viewReady || !this.order() || !this.hasRouteMapData()) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.renderRouteMap();
      });
    });
  }

  private renderRouteMap(): void {
    if (!this.viewReady) {
      return;
    }

    const mapElement = this.trackingMapRef?.nativeElement;
    const currentOrder = this.order();

    if (!mapElement || !currentOrder) {
      return;
    }

    const deliveryAddress = currentOrder.deliveryAddress;

    if (
      !deliveryAddress ||
      currentOrder.restaurantLatitude == null ||
      currentOrder.restaurantLongitude == null ||
      deliveryAddress.latitude == null ||
      deliveryAddress.longitude == null
    ) {
      return;
    }

    const restaurantLat = currentOrder.restaurantLatitude;
    const restaurantLng = currentOrder.restaurantLongitude;
    const deliveryLat = deliveryAddress.latitude;
    const deliveryLng = deliveryAddress.longitude;

    const restaurantLatLng = L.latLng(restaurantLat, restaurantLng);
    const deliveryLatLng = L.latLng(deliveryLat, deliveryLng);

    if (!this.map) {
      this.map = L.map(mapElement, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        dragging: true,
        minZoom: 12,
        maxZoom: 18
      });

      L.control.zoom({
        position: 'topright'
      }).addTo(this.map);

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(this.map);

      this.routeLayer = L.layerGroup().addTo(this.map);

      this.map.on('drag', () => {
        if (this.allowedBounds) {
          this.map?.panInsideBounds(this.allowedBounds, {
            animate: false
          });
        }
      });

      this.map.on('zoomend', () => {
        if (this.allowedBounds) {
          this.map?.panInsideBounds(this.allowedBounds, {
            animate: false
          });
        }
      });
    }

    this.routeLayer?.clearLayers();

    const distanceKm = this.getRouteDistanceKm(
      restaurantLat,
      restaurantLng,
      deliveryLat,
      deliveryLng
    );

    const routePoints = this.buildCurvedRoute(
      restaurantLatLng,
      deliveryLatLng,
      distanceKm
    );

    L.polyline(routePoints, {
      color: 'rgba(255, 255, 255, 0.92)',
      weight: 8,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.routeLayer!);

    L.polyline(routePoints, {
      color: '#2d3748',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '6 10',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.routeLayer!);

    L.marker(restaurantLatLng, {
      icon: this.createMarkerIcon('restaurant')
    }).addTo(this.routeLayer!);

    L.marker(deliveryLatLng, {
      icon: this.createMarkerIcon('home')
    }).addTo(this.routeLayer!);

    const fitBounds = L.latLngBounds([
      restaurantLatLng,
      deliveryLatLng
    ]);

    if (restaurantLat === deliveryLat && restaurantLng === deliveryLng) {
      this.map.setView(restaurantLatLng, 15);
    } else {
      this.map.fitBounds(fitBounds, {
        padding: [30, 30],
        maxZoom: 15
      });
    }

    this.allowedBounds = this.createRadiusBoundsFromCenter(
      fitBounds.getCenter(),
      distanceKm + 8
    );

    this.map.setMaxBounds(this.allowedBounds.pad(0.04));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize();

        if (this.allowedBounds) {
          this.map?.panInsideBounds(this.allowedBounds, {
            animate: false
          });
        }
      });
    });
  }

  private buildCurvedRoute(
    start: L.LatLng,
    end: L.LatLng,
    distanceKm: number
  ): L.LatLngExpression[] {
    const points: L.LatLngExpression[] = [];

    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;

    const bendFactor =
      distanceKm <= 3
        ? 0.34
        : distanceKm <= 8
          ? 0.28
          : distanceKm <= 15
            ? 0.22
            : 0.18;

    const controlLat = midLat + dx * bendFactor;
    const controlLng = midLng - dy * bendFactor;

    for (let i = 0; i <= 40; i++) {
      const t = i / 40;

      const lat =
        (1 - t) * (1 - t) * start.lat +
        2 * (1 - t) * t * controlLat +
        t * t * end.lat;

      const lng =
        (1 - t) * (1 - t) * start.lng +
        2 * (1 - t) * t * controlLng +
        t * t * end.lng;

      points.push([lat, lng]);
    }

    return points;
  }

  private createRadiusBoundsFromCenter(
    center: L.LatLng,
    radiusKm: number
  ): L.LatLngBounds {
    const latDelta = radiusKm / 111;
    const lngDelta =
      radiusKm /
      (111 * Math.cos((center.lat * Math.PI) / 180));

    const southWest = L.latLng(
      center.lat - latDelta,
      center.lng - lngDelta
    );

    const northEast = L.latLng(
      center.lat + latDelta,
      center.lng + lngDelta
    );

    return L.latLngBounds(southWest, northEast);
  }

  private getRouteDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    return (
      earthRadiusKm *
      (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
    );
  }

  private createMarkerIcon(type: 'restaurant' | 'home'): L.DivIcon {
  const icon =
    type === 'restaurant'
      ? `
        <div class="route-marker route-marker-restaurant">
          <div class="route-marker-core route-marker-core-restaurant">
            <i class="bi bi-shop"></i>
          </div>
        </div>
      `
      : `
        <div class="route-marker route-marker-home">
          <div class="route-marker-core route-marker-core-home">
            <i class="bi bi-house-door-fill"></i>
          </div>
        </div>
      `;

  return L.divIcon({
    className: 'route-marker-wrap',
    html: icon,

    // Must match the actual outer marker dimensions in CSS.
    iconSize: [90, 100],

    // x = center of 64px width
    // y = bottom/tip location of 78px marker
    iconAnchor: [3, 7]
  });
}

  private destroyMap(): void {
    if (!this.map) {
      return;
    }

    this.map.remove();
    this.map = null;
    this.routeLayer = null;
    this.allowedBounds = null;
  }

  getHeroTitle(status: OrderStatus | undefined): string {
    switch (status) {
      case 'PLACED':
        return 'Order placed successfully';
      case 'CONFIRMED':
        return 'Restaurant confirmed your order';
      case 'PREPARING':
        return 'Preparing your order';
      case 'PICKED_UP':
        return 'Order picked up';
      case 'OUT_FOR_DELIVERY':
        return 'Your order is on the way';
      case 'DELIVERED':
        return 'Order delivered';
      case 'CANCELLED':
        return 'Order cancelled';
      default:
        return 'Tracking your order';
    }
  }

  getEtaSubtext(status: OrderStatus | undefined): string {
    switch (status) {
      case 'DELIVERED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        return 'Rider en route';
      case 'PREPARING':
        return 'On time';
      case 'CONFIRMED':
        return 'Accepted by restaurant';
      case 'PLACED':
        return 'Waiting for confirmation';
      default:
        return 'Live tracking';
    }
  }

  isStepCompleted(index: number): boolean {
    return (
      this.currentStepIndex() >= 0 &&
      index <= this.currentStepIndex()
    );
  }

  isStepCurrent(index: number): boolean {
    return index === this.currentStepIndex();
  }

  getAddressLabel(): string {
    const address = this.order()?.deliveryAddress;

    if (!address) {
      return 'Delivery address';
    }

    if (address.label === 'OTHER' && address.customLabel?.trim()) {
      return address.customLabel.trim();
    }

    return address.label || 'Delivery address';
  }

  getFullAddress(): string {
    const address = this.order()?.deliveryAddress;

    if (!address) {
      return '';
    }

    return [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
      address.city,
      address.state,
      address.postalCode
    ]
      .filter(Boolean)
      .join(', ');
  }

  getCustomerPhone(): string {
    return (
      this.order()?.deliveryAddress?.phoneNumber ||
      'Phone number unavailable'
    );
  }

  getCustomerName(): string {
    return (
      this.order()?.deliveryAddress?.receiverName ||
      'Customer'
    );
  }

  getRestaurantLocationText(): string {
    return (
      this.order()?.restaurantLocation ||
      'Restaurant location unavailable'
    );
  }

  getRestaurantMetaLine(): string {
    const order = this.order();

    if (!order) {
      return '';
    }

    const parts: string[] = [];

    if (order.restaurantDistanceKm != null) {
      parts.push(`${order.restaurantDistanceKm.toFixed(1)} km away`);
    }

    if (order.restaurantEstimatedMinutes != null) {
      parts.push(`${order.restaurantEstimatedMinutes} mins base ETA`);
    }

    return parts.join(' • ');
  }

  getItemsCountText(): string {
    const items = this.order()?.items || [];

    const count = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    return `${count} item${count === 1 ? '' : 's'}`;
  }

  getCookingInstructionsPreview(): string {
    const instructions = this.order()?.cookingInstructions?.trim();

    return instructions
      ? instructions
      : 'Help the chef prepare it just the way you like';
  }

  getPaymentMethodLabel(method: string | undefined): string {
    switch (method) {
      case 'CASH_ON_DELIVERY':
        return 'Cash on Delivery';
      case 'PHONEPE':
        return 'PhonePe';
      case 'GPAY':
        return 'Google Pay';
      case 'PAYTM':
        return 'Paytm';
      case 'CARD':
        return 'Card';
      case 'UPI':
        return 'UPI';
      default:
        return 'Payment method not available';
    }
  }

  getPaymentStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'PAID':
        return 'Paid';
      case 'PENDING':
        return 'Pending';
      case 'FAILED':
        return 'Failed';
      case 'REFUNDED':
        return 'Refunded';
      default:
        return status || 'Unknown';
    }
  }

  getPaymentStatusClass(status: string | undefined): string {
    switch (status) {
      case 'PAID':
        return 'payment-paid';
      case 'FAILED':
        return 'payment-failed';
      case 'PENDING':
        return 'payment-pending';
      case 'REFUNDED':
        return 'payment-refunded';
      default:
        return 'payment-pending';
    }
  }

  getPartnerTitle(status: OrderStatus | undefined): string {
    switch (status) {
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        return 'Delivery partner details coming soon';
      case 'DELIVERED':
        return 'Order delivered successfully';
      case 'CANCELLED':
        return 'Delivery was not started';
      default:
        return 'Assigning delivery partner shortly';
    }
  }

  getPartnerSubtitle(status: OrderStatus | undefined): string {
    switch (status) {
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        return 'Live rider details and chat can be plugged in next.';
      case 'DELIVERED':
        return 'This order has already been completed.';
      case 'CANCELLED':
        return 'This order was cancelled before delivery.';
      default:
        return 'Chat and direct calling will be available in a future phase.';
    }
  }

  onChatPartner(): void {
    this.showToast('Delivery partner chat coming soon', 'info');
  }

  onPartnerCall(): void {
    this.showToast('Delivery partner calling feature coming soon', 'info');
  }

  onCallRestaurant(): void {
    this.showToast('Restaurant calling feature coming soon', 'info');
  }

  onHelpSupport(): void {
    this.showToast('Help & support module coming soon', 'info');
  }

  onShareOrder(): void {
    this.showToast('Order sharing feature coming soon', 'info');
  }

  orderTracking_ConfirmCancelOrder(): void {
    if (this.cancellingOrder()) {
      return;
    }

    this.cancellingOrder.set(true);

    const cancelledBy: CancelledBy = 'USER';

    this.orderService.cancelOrder(this.orderId, { cancelledBy }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancellingOrder.set(false);

        const refund = updated.refundAmount ?? 0;

        this.showToast(
          refund > 0
            ? `Order cancelled. ₹${refund.toFixed(2)} will be refunded shortly.`
            : 'Order cancelled. No refund applies as preparation had started.',
          'success'
        );
      },
      error: (err) => {
        this.cancellingOrder.set(false);

        this.showToast(
          err?.error?.message ||
          'Unable to cancel order. Please try again.',
          'error'
        );
      }
    });
  }

  orderTracking_PrepareAddressUpdate(): void {
    const order = this.order();

    if (!order) {
      return;
    }

    this.selectedAddressId.set(order.deliveryAddress?.addressId ?? null);
    this.showAllSavedAddresses.set(false);
    this.loadSavedAddresses();
  }

  orderTracking_ShowMoreSavedAddresses(): void {
    this.showAllSavedAddresses.set(true);
  }

  private loadSavedAddresses(): void {
    this.loadingSavedAddresses.set(true);

    this.userService.getSavedAddresses().subscribe({
      next: (addresses) => {
        this.savedAddressList.set(addresses || []);
        this.loadingSavedAddresses.set(false);
      },
      error: () => {
        this.savedAddressList.set([]);
        this.loadingSavedAddresses.set(false);
        this.showToast('Unable to load your saved addresses.', 'error');
      }
    });
  }

  orderTracking_SelectAddressOption(address: AddressResponse): void {
    this.selectedAddressId.set(address.id ?? null);
  }

  isAddressSelected(address: AddressResponse): boolean {
    return this.selectedAddressId() === address.id;
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const earthRadiusKm = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  orderTracking_ConfirmAddressUpdate(): void {
    const order = this.order();
    const addressId = this.selectedAddressId();

    if (!order) {
      return;
    }

    if (addressId == null) {
      this.showToast('Select an address to continue.', 'warning');
      return;
    }

    const newAddress = this.savedAddressList().find(
      address => address.id === addressId
    );

    if (!newAddress) {
      this.showToast('Selected address not found.', 'error');
      return;
    }

    const restaurantLat = order.restaurantLatitude;
    const restaurantLng = order.restaurantLongitude;
    const currentDistanceKm = order.restaurantDistanceKm ?? null;

    if (
      restaurantLat == null ||
      restaurantLng == null ||
      newAddress.latitude == null ||
      newAddress.longitude == null ||
      currentDistanceKm == null
    ) {
      this.showToast(
        'Unable to verify delivery distance for this address.',
        'error'
      );
      return;
    }

    const newDistanceKm = this.haversineKm(
      restaurantLat,
      restaurantLng,
      newAddress.latitude,
      newAddress.longitude
    );

    const allowedCeiling = Math.min(
      currentDistanceKm + ADDRESS_DELTA_BUFFER_KM,
      MAX_DELIVERY_DISTANCE_KM
    );

    if (newDistanceKm > allowedCeiling) {
      this.showToast(
        `New address is ${newDistanceKm.toFixed(1)} km away — you can only switch within ${allowedCeiling.toFixed(1)} km of your current delivery distance. Distance is too long from the range, you cannot change the address.`,
        'warning'
      );
      return;
    }

    this.savingUpdatedAddress.set(true);

    this.orderService.updateOrderAddress(this.orderId, {
      addressId: newAddress.id,
      label: newAddress.label,
      customLabel: newAddress.customLabel ?? undefined,
      receiverName: newAddress.receiverName,
      phoneNumber: newAddress.phoneNumber,
      addressLine1: newAddress.addressLine1,
      addressLine2: newAddress.addressLine2,
      landmark: newAddress.landmark,
      city: newAddress.city,
      state: newAddress.state,
      postalCode: newAddress.postalCode,
      latitude: newAddress.latitude,
      longitude: newAddress.longitude
    }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.savingUpdatedAddress.set(false);

        this.showToast(
          'Delivery address updated successfully.',
          'success'
        );

        this.tryRenderRouteMap();
      },
      error: (err) => {
        this.savingUpdatedAddress.set(false);

        this.showToast(
          err?.error?.message ||
          'Unable to update address. Please try again.',
          'error'
        );
      }
    });
  }

  orderTracking_PrepareContactUpdate(): void {
    const order = this.order();

    if (!order) {
      return;
    }

    this.updatedReceiverName.set(
      order.deliveryAddress?.receiverName || ''
    );

    this.updatedPhoneNumber.set(
      order.deliveryAddress?.phoneNumber || ''
    );
  }

  private isValidPhoneNumber(phone: string): boolean {
    return /^[6-9]\d{9}$/.test(phone.trim());
  }

  orderTracking_ConfirmContactUpdate(): void {
    const order = this.order();

    if (!order) {
      return;
    }

    const receiverName = this.updatedReceiverName().trim();
    const phoneNumber = this.updatedPhoneNumber().trim();

    if (!receiverName) {
      this.showToast('Enter a valid receiver name.', 'warning');
      return;
    }

    if (!this.isValidPhoneNumber(phoneNumber)) {
      this.showToast(
        'Enter a valid 10-digit phone number.',
        'warning'
      );
      return;
    }

    this.savingUpdatedContact.set(true);

    const payload: UpdateOrderContactRequest = {
      receiverName,
      phoneNumber
    };

    this.orderService.updateOrderContact(this.orderId, payload).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.savingUpdatedContact.set(false);

        this.showToast(
          'Contact details updated successfully.',
          'success'
        );
      },
      error: (err) => {
        this.savingUpdatedContact.set(false);

        this.showToast(
          err?.error?.message ||
          'Unable to update contact details. Please try again.',
          'error'
        );
      }
    });
  }

  orderTracking_PrepareInstructionsUpdate(): void {
    this.updatedCookingInstructions.set('');
  }

  orderTracking_ConfirmInstructionsUpdate(): void {
    const order = this.order();

    if (!order) {
      return;
    }

    const cookingInstructions = this.updatedCookingInstructions().trim();

    if (
      cookingInstructions.length <
      COOKING_INSTRUCTIONS_MIN_LENGTH
    ) {
      this.showToast(
        `Cooking instructions must be at least ${COOKING_INSTRUCTIONS_MIN_LENGTH} characters.`,
        'warning'
      );
      return;
    }

    if (
      cookingInstructions.length >
      COOKING_INSTRUCTIONS_MAX_LENGTH
    ) {
      this.showToast(
        `Cooking instructions must be under ${COOKING_INSTRUCTIONS_MAX_LENGTH} characters.`,
        'warning'
      );
      return;
    }

    this.savingUpdatedInstructions.set(true);

    const payload: UpdateOrderInstructionsRequest = {
      cookingInstructions
    };

    this.orderService.updateOrderInstructions(this.orderId, payload).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.savingUpdatedInstructions.set(false);

        this.showToast(
          'Cooking instructions saved successfully.',
          'success'
        );
      },
      error: (err) => {
        this.savingUpdatedInstructions.set(false);

        this.showToast(
          err?.error?.message ||
          'Unable to save cooking instructions. Please try again.',
          'error'
        );
      }
    });
  }
}