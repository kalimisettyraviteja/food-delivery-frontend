import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant } from '../../../core/services/restaurant';
import { UserService, UserResponse } from '../../../core/services/user';

declare const L: any;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

@Component({
  selector: 'app-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurants.html',
  styleUrl: './restaurants.css'
})
export class Restaurants implements OnInit {
  private svc = inject(RestaurantService);
  private userService = inject(UserService);

  restaurants = signal<Restaurant[]>([]);
  managers = signal<UserResponse[]>([]);
  searchText = signal('');
  loading = signal(false);
  managersLoading = signal(false);

  showAddModal = false;
  showEditModal = false;

  editId: number | null = null;
  addErrorMsg = '';
  addSuccessMsg = '';
  editErrorMsg = '';
  editSuccessMsg = '';
  successMsg = '';

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  map: any = null;
  mapPickedText = '';
  mapLoading = false;
  mapSearchQuery = '';
  mapSearchResults: NominatimResult[] = [];
  private mapSearchDebounceTimer: any;

  private addErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private addSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  private editErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private editSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  form: Restaurant = this.getEmptyForm();

  filteredRestaurants = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    const list = this.restaurants();

    if (!term) return list;

    return list.filter(r =>
      (r.name ?? '').toLowerCase().includes(term) ||
      (r.location ?? '').toLowerCase().includes(term) ||
      (r.cuisine ?? '').toLowerCase().includes(term) ||
      this.getManagerName(r.managerId).toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadAll();
    this.loadManagers();
  }

  private getEmptyForm(): Restaurant {
    return {
      name: '',
      location: '',
      cuisine: '',
      rating: 0,
      ratingCount: 0,
      isActive: true,
      isPureVeg: false,
      latitude: null,
      longitude: null,
      image: null,
      managerId: null,
      estimatedMinutes: 0
    };
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | null) {
    if (timer) clearTimeout(timer);
  }

  private stripFieldPrefix(msg: string): string {
    const i = msg.indexOf(':');
    return i >= 0 ? msg.slice(i + 1).trim() : msg.trim();
  }

  private getErrorMessage(err: any): string {
    const backendMessages = err?.error?.messages;
    let rawMsg = '';

    if (Array.isArray(backendMessages) && backendMessages.length > 0) {
      rawMsg = backendMessages[0];
    } else if (typeof err?.error?.message === 'string' && err.error.message.trim()) {
      rawMsg = err.error.message;
    } else if (typeof err?.error?.error === 'string' && err.error.error.trim()) {
      rawMsg = err.error.error;
    } else if (typeof err?.message === 'string' && err.message.trim()) {
      rawMsg = err.message;
    } else {
      rawMsg = 'Something went wrong.';
    }

    return this.stripFieldPrefix(rawMsg);
  }

  private showAddError(msg: string) {
    this.clearTimer(this.addErrorTimer);
    this.addErrorMsg = msg;
    this.addErrorTimer = setTimeout(() => { this.addErrorMsg = ''; }, 2500);
  }

  private showAddSuccess(msg: string) {
    this.clearTimer(this.addSuccessTimer);
    this.addSuccessMsg = msg;
    this.addSuccessTimer = setTimeout(() => { this.addSuccessMsg = ''; }, 2000);
  }

  private showEditError(msg: string) {
    this.clearTimer(this.editErrorTimer);
    this.editErrorMsg = msg;
    this.editErrorTimer = setTimeout(() => { this.editErrorMsg = ''; }, 2500);
  }

  private showEditSuccess(msg: string) {
    this.clearTimer(this.editSuccessTimer);
    this.editSuccessMsg = msg;
    this.editSuccessTimer = setTimeout(() => { this.editSuccessMsg = ''; }, 2000);
  }

  private showToast(msg: string) {
    this.clearTimer(this.toastTimer);
    this.successMsg = msg;
    this.toastTimer = setTimeout(() => { this.successMsg = ''; }, 2000);
  }

    loadAll() {
  this.loading.set(true);
  this.svc.getAllAdmin().subscribe({
    next: (data) => {
      this.restaurants.set(data);
      this.loading.set(false);
    },
    error: (err) => {
      this.loading.set(false);
      this.showToast(this.getErrorMessage(err));}
  });
}

  loadManagers() {
    this.managersLoading.set(true);
    this.userService.getApprovedManagers().subscribe({
      next: (data) => {
        this.managers.set(data ?? []);
        this.managersLoading.set(false);
      },
      error: (err) => {
        this.showToast(this.getErrorMessage(err));
        this.managers.set([]);
        this.managersLoading.set(false);
      }
    });
  }

  onSearchChange(value: string) {
    this.searchText.set(value);
  }

  getManagerName(managerId?: number | null): string {
    if (!managerId) return 'Not assigned';
    const manager = this.managers().find(m => m.id === managerId);
    return manager?.name || `Manager #${managerId}`;
  }

  getVegBadgeClass(isPureVeg?: boolean | null): string {
    return isPureVeg ? 'veg-badge pure-veg' : 'veg-badge non-veg';
  }

  getVegLabel(isPureVeg?: boolean | null): string {
    return isPureVeg ? 'Pure Veg' : 'Non-Veg';
  }

  // ── Add / Edit modal open-close ─────────────────────────

  openAdd() {
    this.form = this.getEmptyForm();
    this.addErrorMsg = '';
    this.addSuccessMsg = '';
    this.showAddModal = true;
    this.showEditModal = false;
    this.editId = null;
    this.mapPickedText = '';
    this.mapSearchQuery = '';
    this.mapSearchResults = [];

    setTimeout(() => this.initMap(), 120);
  }

  closeAddModal() {
    this.showAddModal = false;
    this.addErrorMsg = '';
    this.addSuccessMsg = '';
    this.clearTimer(this.addErrorTimer);
    this.clearTimer(this.addSuccessTimer);
    this.destroyMap();
  }

  openEdit(r: Restaurant) {
    this.form = {
      id: r.id,
      name: r.name,
      location: r.location,
      cuisine: r.cuisine,
      rating: r.rating ?? 0,
      ratingCount: r.ratingCount ?? 0,
      estimatedMinutes: r.estimatedMinutes ?? 0,
      isActive: r.isActive ?? true,
      isPureVeg: r.isPureVeg ?? false,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      image: r.image ?? null,
      managerId: r.managerId ?? null
    };
    this.editId = r.id!;
    this.selectedImageFile = null;
    this.imagePreview = r.image ?? null;
    this.editErrorMsg = '';
    this.editSuccessMsg = '';
    this.showEditModal = true;
    this.showAddModal = false;
    this.mapPickedText = r.location || '';
    this.mapSearchQuery = '';
    this.mapSearchResults = [];

    setTimeout(() => this.initMap(), 120);
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editErrorMsg = '';
    this.editSuccessMsg = '';
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.clearTimer(this.editErrorTimer);
    this.clearTimer(this.editSuccessTimer);
    this.destroyMap();
  }

  // ── Leaflet Map Picker (same pattern as saved-addresses) ─

  initMap(): void {
    const mapDiv = document.getElementById('restMapPicker');
    if (!mapDiv || typeof L === 'undefined') return;

    const defaultLat = this.form.latitude ?? 12.9716;
    const defaultLng = this.form.longitude ?? 77.5946;

    this.destroyMap();

    this.map = L.map('restMapPicker', {
      center: [defaultLat, defaultLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      this.setLatLng(center.lat, center.lng);
      this.reverseGeocode(center.lat, center.lng);
    });

    if (!this.form.latitude || !this.form.longitude) {
      this.useCurrentLocation();
    } else {
      this.setLatLng(defaultLat, defaultLng);
      this.reverseGeocode(defaultLat, defaultLng);
    }

    setTimeout(() => this.map?.invalidateSize(), 300);
    setTimeout(() => this.map?.invalidateSize(), 700);
  }

  destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.mapSearchQuery = '';
    this.mapSearchResults = [];
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      if (this.showAddModal) this.showAddError('Geolocation is not supported on this device.');
      if (this.showEditModal) this.showEditError('Geolocation is not supported on this device.');
      return;
    }

    this.mapLoading = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.map?.setView([lat, lng], 15);
        this.setLatLng(lat, lng);
        this.reverseGeocode(lat, lng);
        this.mapLoading = false;
      },
      () => {
        this.mapLoading = false;
      }
    );
  }

  setLatLng(lat: number, lng: number): void {
    this.form.latitude = Number(lat.toFixed(6));
    this.form.longitude = Number(lng.toFixed(6));
  }

  reverseGeocode(lat: number, lng: number): void {
    this.mapLoading = true;

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then((res) => res.json())
      .then((data) => {
        this.mapLoading = false;

        if (data && data.display_name) {
          this.mapPickedText = data.display_name;
          this.form.location = data.display_name;
        }
      })
      .catch(() => {
        this.mapLoading = false;
      });
  }

  onMapSearchInput(): void {
    clearTimeout(this.mapSearchDebounceTimer);

    if (!this.mapSearchQuery || this.mapSearchQuery.trim().length < 3) {
      this.mapSearchResults = [];
      return;
    }

    this.mapSearchDebounceTimer = setTimeout(() => {
      this.performMapSearch(this.mapSearchQuery.trim());
    }, 600);
  }

  performMapSearch(query: string): void {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;

    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then((res) => res.json())
      .then((data: NominatimResult[]) => {
        this.mapSearchResults = data || [];
      })
      .catch(() => {
        this.mapSearchResults = [];
      });
  }

  selectMapSearchResult(result: NominatimResult): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    this.map?.setView([lat, lng], 16);
    this.setLatLng(lat, lng);
    this.mapPickedText = result.display_name;
    this.form.location = result.display_name;

    this.mapSearchQuery = '';
    this.mapSearchResults = [];
  }

  // ── File upload ──────────────────────────────────────────

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.selectedImageFile = input.files[0];
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = reader.result as string;
    reader.readAsDataURL(this.selectedImageFile);
  }

  // ── Save / Delete ─────────────────────────────────────────

  saveRestaurantDetails() {
    if (!this.form.name || !this.form.location || !this.form.cuisine) {
      const msg = 'Name, Location and Cuisine are required.';
      if (this.showAddModal) this.showAddError(msg);
      if (this.showEditModal) this.showEditError(msg);
      return;
    }

    if (this.form.latitude === null || this.form.latitude === undefined ||
        this.form.longitude === null || this.form.longitude === undefined) {
      const msg = 'Please pick a location on the map.';
      if (this.showAddModal) this.showAddError(msg);
      if (this.showEditModal) this.showEditError(msg);
      return;
    }

    if (this.form.isPureVeg === null || this.form.isPureVeg === undefined) {
      const msg = 'Please specify if this is a pure veg restaurant.';
      if (this.showAddModal) this.showAddError(msg);
      if (this.showEditModal) this.showEditError(msg);
      return;
    }

    const payload: Restaurant = {
      name: this.form.name,
      location: this.form.location,
      cuisine: this.form.cuisine,
      rating: this.form.rating ?? 0,
      ratingCount: this.form.ratingCount ?? 0,
      isActive: this.form.isActive,
      isPureVeg: this.form.isPureVeg,
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      managerId: this.form.managerId ?? null
    };

    const req = this.editId
      ? this.svc.update(this.editId, payload)
      : this.svc.create(payload);

    req.subscribe({
      next: (saved) => {
        this.loadAll();

        if (this.editId) {
          this.editId = saved.id!;
          this.form.managerId = saved.managerId ?? this.form.managerId ?? null;
          this.showEditSuccess('Restaurant details updated!');
        } else {
          this.showAddSuccess('Restaurant added!');
          this.closeAddModal();
        }
      },
      error: (err) => {
        const msg = this.getErrorMessage(err);
        if (this.showAddModal) this.showAddError(msg);
        if (this.showEditModal) this.showEditError(msg);
      }
    });
  }

  uploadRestaurantImage() {
    if (!this.editId) {
      this.showEditError('Open a restaurant first.');
      return;
    }

    if (!this.selectedImageFile) {
      this.showEditError('Please select an image first.');
      return;
    }

    this.svc.uploadRestaurantImage(this.editId, this.selectedImageFile).subscribe({
      next: (updated) => {
        this.form.image = updated.image ?? null;
        this.imagePreview = updated.image ?? null;
        this.selectedImageFile = null;
        this.loadAll();
        this.showEditSuccess('Image updated successfully.');
      },
      error: (err) => {
        this.showEditError(this.getErrorMessage(err));
      }
    });
  }

  removeRestaurantImage() {
    if (!this.editId) return;
    if (!confirm('Remove restaurant image?')) return;

    this.svc.deleteRestaurantImage(this.editId).subscribe({
      next: () => {
        this.form.image = null;
        this.imagePreview = null;
        this.selectedImageFile = null;
        this.loadAll();
        this.showEditSuccess('Image removed successfully.');
      },
      error: (err) => {
        this.showEditError(this.getErrorMessage(err));
      }
    });
  }

  delete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    this.svc.delete(id).subscribe({
      next: () => {
        this.loadAll();
        this.showToast('Restaurant deleted successfully.');
      },
      error: (err) => {
        this.showToast(this.getErrorMessage(err));
      }
    });
  }
}