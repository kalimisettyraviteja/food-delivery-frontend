import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AddressRequest,
  AddressResponse,
  UserService
} from '../../../core/services/user';

declare const bootstrap: any;
declare const L: any;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
}

interface AddressFormSnapshot {
  label: 'HOME' | 'WORK' | 'OTHER';
  customLabel: string;
  receiverName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

@Component({
  selector: 'app-saved-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './saved-addresses.html',
  styleUrl: './saved-addresses.css'
})
export class SavedAddresses
  implements OnInit, AfterViewInit, OnDestroy {
  private readonly userService = inject(UserService);

  addresses: AddressResponse[] = [];

  loading = false;
  submitting = false;
  deletingAddress = false;

  errorMessage = '';
  successMessage = '';

  modalMessage = '';
  modalMessageType: 'success' | 'error' | 'warning' = 'warning';

  private modalMessageTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  private pageMessageTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  editMode = false;
  editingAddressId: number | null = null;

  selectedLabelOption: 'HOME' | 'WORK' | 'OTHER' = 'HOME';
  customOtherLabel = '';

  form: AddressRequest = this.getEmptyForm();

  private initialAddressSnapshot: AddressFormSnapshot | null = null;

  private addressModal: any;
  private deleteAddressModal: any;

  addressToDelete: AddressResponse | null = null;

  map: any;
  mapPickedText = '';
  mapLoading = false;

  searchQuery = '';
  searchResults: NominatimResult[] = [];

  private searchDebounceTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  skeletonItems = Array.from({ length: 4 });

  ngOnInit(): void {
    this.loadAddresses();
  }

  ngAfterViewInit(): void {
    this.initializeAddressModal();
    this.initializeDeleteModal();
  }

  ngOnDestroy(): void {
    this.destroyMap();
    this.clearModalMessage();
    this.clearPageMessageTimer();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  get hasSelectedLocation(): boolean {
    return (
      this.form.latitude !== null &&
      this.form.latitude !== undefined &&
      this.form.longitude !== null &&
      this.form.longitude !== undefined
    );
  }

  get hasAddressChanges(): boolean {
    if (!this.editMode || !this.initialAddressSnapshot) {
      return true;
    }

    const currentSnapshot = this.createAddressSnapshot();

    return (
      JSON.stringify(currentSnapshot) !==
      JSON.stringify(this.initialAddressSnapshot)
    );
  }

  /* =================================================
     Bootstrap modal setup
     ================================================= */

  private initializeAddressModal(): void {
    const modalElement = document.getElementById('addressModal');

    if (!modalElement) {
      return;
    }

    this.addressModal = bootstrap.Modal.getOrCreateInstance(
      modalElement,
      {
        backdrop: 'static',
        keyboard: false
      }
    );

    modalElement.addEventListener('shown.bs.modal', () => {
      this.initMap();
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
      this.destroyMap();
      this.resetFormState();
    });
  }

  private initializeDeleteModal(): void {
    const modalElement = document.getElementById(
      'deleteAddressModal'
    );

    if (!modalElement) {
      return;
    }

    this.deleteAddressModal = bootstrap.Modal.getOrCreateInstance(
      modalElement,
      {
        backdrop: 'static',
        keyboard: false
      }
    );

    modalElement.addEventListener('hidden.bs.modal', () => {
      if (!this.deletingAddress) {
        this.addressToDelete = null;
      }
    });
  }

  /* =================================================
     Form state
     ================================================= */

  getEmptyForm(): AddressRequest {
    return {
      label: 'HOME',
      customLabel: '',
      receiverName: '',
      phoneNumber: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      postalCode: '',
      latitude: null,
      longitude: null,
      isDefault: false
    };
  }

  private createAddressSnapshot(): AddressFormSnapshot {
    return {
      label: this.selectedLabelOption,

      customLabel:
        this.selectedLabelOption === 'OTHER'
          ? (this.customOtherLabel || '').trim()
          : '',

      receiverName: (this.form.receiverName || '').trim(),
      phoneNumber: (this.form.phoneNumber || '').trim(),
      addressLine1: (this.form.addressLine1 || '').trim(),
      addressLine2: (this.form.addressLine2 || '').trim(),
      landmark: (this.form.landmark || '').trim(),
      city: (this.form.city || '').trim(),
      state: (this.form.state || '').trim(),
      postalCode: (this.form.postalCode || '').trim(),
      latitude: this.normalizeCoordinate(this.form.latitude),
      longitude: this.normalizeCoordinate(this.form.longitude),
      isDefault: Boolean(this.form.isDefault)
    };
  }

  private normalizeCoordinate(
    value: number | null | undefined
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(Number(value).toFixed(6));
  }

  resetFormState(): void {
    this.editMode = false;
    this.editingAddressId = null;
    this.initialAddressSnapshot = null;

    this.selectedLabelOption = 'HOME';
    this.customOtherLabel = '';

    this.form = this.getEmptyForm();

    this.submitting = false;

    this.mapPickedText = '';
    this.mapLoading = false;

    this.searchQuery = '';
    this.searchResults = [];

    this.clearModalMessage();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  /* =================================================
     Page and modal messages
     ================================================= */

  showModalMessage(
    message: string,
    type: 'success' | 'error' | 'warning' = 'warning',
    duration = 3000
  ): void {
    this.modalMessage = message;
    this.modalMessageType = type;

    if (this.modalMessageTimer) {
      clearTimeout(this.modalMessageTimer);
    }

    this.modalMessageTimer = setTimeout(() => {
      this.clearModalMessage();
    }, duration);
  }

  clearModalMessage(): void {
    this.modalMessage = '';

    if (this.modalMessageTimer) {
      clearTimeout(this.modalMessageTimer);
      this.modalMessageTimer = null;
    }
  }

  showPageToast(
    message: string,
    type: 'success' | 'error'
  ): void {
    this.clearPageMessageTimer();

    if (type === 'success') {
      this.successMessage = message;
      this.errorMessage = '';
    } else {
      this.errorMessage = message;
      this.successMessage = '';
    }

    this.pageMessageTimer = setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
      this.pageMessageTimer = null;
    }, type === 'success' ? 3000 : 4000);
  }

  private clearPageMessageTimer(): void {
    if (this.pageMessageTimer) {
      clearTimeout(this.pageMessageTimer);
      this.pageMessageTimer = null;
    }
  }

  /* =================================================
     Address list
     ================================================= */

  loadAddresses(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userService.getSavedAddresses().subscribe({
      next: response => {
        this.addresses = response ?? [];
        this.loading = false;
      },

      error: error => {
        this.loading = false;

        this.showPageToast(
          error?.error?.message ||
          'Failed to load saved addresses.',
          'error'
        );
      }
    });
  }

  /* =================================================
     Add address
     ================================================= */

  openAddModal(): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.resetFormState();

    if (this.addresses.length === 0) {
      this.form.isDefault = true;
    }

    this.initialAddressSnapshot = null;

    this.openAddressModal();
  }

  /* =================================================
     Edit address
     ================================================= */

  openEditModal(address: AddressResponse): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.destroyMap();
    this.clearModalMessage();

    this.editMode = true;
    this.editingAddressId = address.id;

    this.form = {
      label: address.label,
      customLabel: address.customLabel || '',
      receiverName: address.receiverName,
      phoneNumber: address.phoneNumber,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      isDefault: address.isDefault
    };

    if (
      address.label === 'HOME' ||
      address.label === 'WORK'
    ) {
      this.selectedLabelOption = address.label;
      this.customOtherLabel = '';
    } else {
      this.selectedLabelOption = 'OTHER';
      this.customOtherLabel = address.customLabel || '';
    }

    this.mapPickedText = address.addressLine1 || '';

    this.initialAddressSnapshot =
      this.createAddressSnapshot();

    this.openAddressModal();
  }

  private openAddressModal(): void {
    if (!this.addressModal) {
      this.initializeAddressModal();
    }

    this.addressModal?.show();
  }

  closeModal(): void {
    this.addressModal?.hide();
  }

  /* =================================================
     Delete address
     ================================================= */

  openDeleteModal(address: AddressResponse): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.addressToDelete = address;
    this.deletingAddress = false;

    if (!this.deleteAddressModal) {
      this.initializeDeleteModal();
    }

    this.deleteAddressModal?.show();
  }

  confirmDeleteAddress(): void {
    if (
      !this.addressToDelete ||
      this.deletingAddress
    ) {
      return;
    }

    const addressId = this.addressToDelete.id;

    this.deletingAddress = true;

    this.userService.deleteAddress(addressId).subscribe({
      next: () => {
        this.deletingAddress = false;

        this.deleteAddressModal?.hide();

        this.showPageToast(
          'Address deleted successfully.',
          'success'
        );

        this.loadAddresses();
      },

      error: error => {
        this.deletingAddress = false;

        this.showPageToast(
          error?.error?.message ||
          'Failed to delete address.',
          'error'
        );
      }
    });
  }

  /* =================================================
     Default address
     ================================================= */

  makeDefault(addressId: number): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.setDefaultAddress(addressId).subscribe({
      next: () => {
        this.showPageToast(
          'Default address updated successfully.',
          'success'
        );

        this.loadAddresses();
      },

      error: error => {
        this.showPageToast(
          error?.error?.message ||
          'Failed to update default address.',
          'error'
        );
      }
    });
  }

  /* =================================================
     Map
     ================================================= */

  initMap(): void {
    const mapElement = document.getElementById('mapPicker');

    if (!mapElement || typeof L === 'undefined') {
      this.showModalMessage(
        'Map could not be loaded. Please try again.',
        'warning'
      );

      return;
    }

    const defaultLatitude =
      this.form.latitude ?? 14.6819;

    const defaultLongitude =
      this.form.longitude ?? 77.6006;

    this.destroyMap();

    this.map = L.map('mapPicker', {
      center: [
        defaultLatitude,
        defaultLongitude
      ],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.control
      .zoom({
        position: 'bottomright'
      })
      .addTo(this.map);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19
      }
    ).addTo(this.map);

    this.map.on('moveend', () => {
      const center = this.map.getCenter();

      this.setLatLng(
        center.lat,
        center.lng
      );

      this.reverseGeocode(
        center.lat,
        center.lng
      );
    });

    if (!this.hasSelectedLocation) {
      this.useCurrentLocation();
    } else {
      this.setLatLng(
        defaultLatitude,
        defaultLongitude
      );

      this.reverseGeocode(
        defaultLatitude,
        defaultLongitude
      );
    }

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 250);

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 600);
  }

  destroyMap(): void {
    if (!this.map) {
      return;
    }

    this.map.remove();
    this.map = null;
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.showModalMessage(
        'Geolocation is not supported on this device.',
        'warning'
      );

      return;
    }

    this.mapLoading = true;

    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        this.map?.setView(
          [latitude, longitude],
          16
        );

        this.setLatLng(
          latitude,
          longitude
        );

        this.reverseGeocode(
          latitude,
          longitude
        );
      },

      () => {
        this.mapLoading = false;

        this.showModalMessage(
          'Unable to access your current location. Search for a location instead.',
          'warning'
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  setLatLng(
    latitude: number,
    longitude: number
  ): void {
    this.form.latitude = latitude;
    this.form.longitude = longitude;
  }

  reverseGeocode(
    latitude: number,
    longitude: number
  ): void {
    this.mapLoading = true;

    const url =
      'https://nominatim.openstreetmap.org/reverse' +
      `?lat=${latitude}` +
      `&lon=${longitude}` +
      '&format=json' +
      '&addressdetails=1';

    fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    })
      .then(response => response.json())
      .then(data => {
        this.mapLoading = false;

        if (!data?.display_name) {
          return;
        }

        this.mapPickedText = data.display_name;
        this.form.addressLine1 = data.display_name;

        const address = data.address || {};

        this.form.city =
          address.city ||
          address.town ||
          address.village ||
          this.form.city;

        this.form.state =
          address.state ||
          this.form.state;

        this.form.postalCode =
          address.postcode ||
          this.form.postalCode;
      })
      .catch(() => {
        this.mapLoading = false;
      });
  }

  /* =================================================
     Map search
     ================================================= */

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    const query = this.searchQuery.trim();

    if (query.length < 3) {
      this.searchResults = [];
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 500);
  }

  clearMapSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  performSearch(query: string): void {
    const url =
      'https://nominatim.openstreetmap.org/search' +
      `?q=${encodeURIComponent(query)}` +
      '&format=json' +
      '&addressdetails=1' +
      '&limit=5';

    fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    })
      .then(response => response.json())
      .then((data: NominatimResult[]) => {
        this.searchResults = data || [];
      })
      .catch(() => {
        this.searchResults = [];
      });
  }

  selectSearchResult(
    result: NominatimResult
  ): void {
    const latitude = Number.parseFloat(result.lat);
    const longitude = Number.parseFloat(result.lon);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return;
    }

    this.map?.setView(
      [latitude, longitude],
      16
    );

    this.setLatLng(
      latitude,
      longitude
    );

    this.mapPickedText = result.display_name;
    this.form.addressLine1 = result.display_name;

    const address = result.address || {};

    this.form.city =
      address.city ||
      address.town ||
      address.village ||
      this.form.city;

    this.form.state =
      address.state ||
      this.form.state;

    this.form.postalCode =
      address.postcode ||
      this.form.postalCode;

    this.clearMapSearch();
  }

  /* =================================================
     Form changes and validation
     ================================================= */

  onLabelOptionChange(
    option: 'HOME' | 'WORK' | 'OTHER'
  ): void {
    this.selectedLabelOption = option;
    this.form.label = option;

    if (option === 'OTHER') {
      this.form.customLabel =
        this.customOtherLabel.trim();

      return;
    }

    this.customOtherLabel = '';
    this.form.customLabel = '';
  }

  onCustomLabelChange(): void {
    if (this.selectedLabelOption === 'OTHER') {
      this.form.customLabel =
        this.customOtherLabel.trim();
    }
  }

  isFormValid(): boolean {
    const customLabelValid =
      this.selectedLabelOption !== 'OTHER' ||
      Boolean(this.customOtherLabel.trim());

    return Boolean(
      this.form.label &&
      customLabelValid &&
      this.form.receiverName?.trim() &&
      this.form.phoneNumber?.trim() &&
      this.form.addressLine1?.trim() &&
      this.form.addressLine2?.trim() &&
      this.form.city?.trim() &&
      this.form.state?.trim() &&
      this.form.postalCode?.trim() &&
      this.hasSelectedLocation
    );
  }

  saveAddress(): void {
    this.form.label = this.selectedLabelOption;

    this.form.customLabel =
      this.selectedLabelOption === 'OTHER'
        ? this.customOtherLabel.trim()
        : '';

    if (!this.isFormValid()) {
      this.showModalMessage(
        'Complete all required fields and choose a location on the map.',
        'warning'
      );

      return;
    }

    if (
      this.editMode &&
      !this.hasAddressChanges
    ) {
      this.showModalMessage(
        'Make a change before updating this address.',
        'warning'
      );

      return;
    }

    this.submitting = true;

    this.errorMessage = '';
    this.successMessage = '';

    this.clearModalMessage();

    const request$ =
      this.editMode &&
      this.editingAddressId !== null
        ? this.userService.updateAddress(
            this.editingAddressId,
            this.form
          )
        : this.userService.addAddress(this.form);

    request$.subscribe({
      next: () => {
        const successText = this.editMode
          ? 'Address updated successfully.'
          : 'Address added successfully.';

        this.submitting = false;

        this.closeModal();

        this.showPageToast(
          successText,
          'success'
        );

        this.loadAddresses();
      },

      error: error => {
        this.submitting = false;

        this.showModalMessage(
          error?.error?.message ||
          'Failed to save address.',
          'error'
        );
      }
    });
  }

  /* =================================================
     Display helpers
     ================================================= */

  getDisplayLabel(address: AddressResponse): string {
    if (address.label === 'OTHER') {
      return address.customLabel?.trim() || 'Other';
    }

    return address.label;
  }

  getLabelIcon(address: AddressResponse): string {
    if (address.label === 'HOME') {
      return 'bi-house-door-fill';
    }

    if (address.label === 'WORK') {
      return 'bi-briefcase-fill';
    }

    return 'bi-bookmark-fill';
  }

  trackByAddressId(
    _index: number,
    address: AddressResponse
  ): number {
    return address.id;
  }
}