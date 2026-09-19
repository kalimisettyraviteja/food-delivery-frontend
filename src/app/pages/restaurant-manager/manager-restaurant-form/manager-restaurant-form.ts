import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Restaurant,
  RestaurantService
} from '../../../core/services/restaurant';

declare const L: any;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

@Component({
  selector: 'app-manager-restaurant-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './manager-restaurant-form.html',
  styleUrl: './manager-restaurant-form.css'
})
export class ManagerRestaurantForm
  implements OnInit, AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private restaurantService = inject(RestaurantService);
  private ngZone = inject(NgZone);

  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(120)
      ]
    ],

    location: [
      '',
      [
        Validators.required,
        Validators.maxLength(500)
      ]
    ],

    cuisine: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ],

    isPureVeg: [false],
    isActive: [true],

    latitude: [
      null as number | null,
      [
        Validators.required,
        Validators.min(-90),
        Validators.max(90)
      ]
    ],

    longitude: [
      null as number | null,
      [
        Validators.required,
        Validators.min(-180),
        Validators.max(180)
      ]
    ]
  });

  mode: 'create' | 'edit' = 'create';
  restaurantId: number | null = null;

  loading = false;
  saving = false;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private toastTimer: any;
  private searchDebounceTimer: any;
  private mapResizeObserver: ResizeObserver | null = null;

  selectedImage: File | null = null;
  imagePreview: string | null = null;
  existingImage: string | null = null;

  map: any;
  mapReady = false;
  mapLoading = false;
  mapPickedText = '';

  searchQuery = '';
  searchResults: NominatimResult[] = [];

  private readonly defaultLatitude = 14.6819;
  private readonly defaultLongitude = 77.6006;

  get isEditMode(): boolean {
    return this.mode === 'edit';
  }

  get pageTitle(): string {
    return this.isEditMode
      ? 'Edit restaurant'
      : 'Create restaurant';
  }

  get saveLabel(): string {
    if (this.saving) {
      return this.isEditMode
        ? 'Saving changes…'
        : 'Creating restaurant…';
    }

    return this.isEditMode
      ? 'Save changes'
      : 'Create restaurant';
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const action = params.get('action');
      const id = Number(params.get('id'));

      this.mode =
        action === 'edit' &&
        Number.isFinite(id) &&
        id > 0
          ? 'edit'
          : 'create';

      this.restaurantId =
        this.mode === 'edit'
          ? id
          : null;

      if (this.restaurantId) {
        this.loadRestaurant(this.restaurantId);
      }
    });
  }

  ngAfterViewInit(): void {
    /*
     * Create mode renders the map immediately.
     * Edit mode initializes the map from loadRestaurant()
     * after *ngIf="!loading" renders the map element.
     */
    if (!this.isEditMode) {
      this.waitForMapElementAndInitialize();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchDebounceTimer);
    clearTimeout(this.toastTimer);

    this.mapResizeObserver?.disconnect();
    this.destroyMap();
  }

  showToast(
    message: string,
    type: 'success' | 'error'
  ): void {
    this.toastMessage = message;
    this.toastType = type;

    clearTimeout(this.toastTimer);

    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
    }, 3500);
  }

  loadRestaurant(id: number): void {
    this.loading = true;

    this.restaurantService.getMyRestaurantById(id).subscribe({
      next: (restaurant) => {
        this.form.patchValue({
          name: restaurant.name ?? '',
          location: restaurant.location ?? '',
          cuisine: restaurant.cuisine ?? '',
          isPureVeg: restaurant.isPureVeg ?? false,
          isActive: restaurant.isActive ?? true,
          latitude: restaurant.latitude ?? null,
          longitude: restaurant.longitude ?? null
        });

        this.existingImage = restaurant.image ?? null;
        this.mapPickedText = restaurant.location ?? '';

        this.loading = false;

        /*
         * Wait until Angular finishes rendering the form and
         * creates #restaurantMapPicker.
         */
        this.waitForMapElementAndInitialize();
      },

      error: (err) => {
        this.loading = false;

        this.showToast(
          err?.error?.message ||
            'Unable to load this restaurant.',
          'error'
        );
      }
    });
  }

  private waitForMapElementAndInitialize(): void {
    let attempts = 0;
    const maximumAttempts = 60;

    const tryInitialize = () => {
      const mapDiv = document.getElementById(
        'restaurantMapPicker'
      );

      if (mapDiv) {
        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => {
            this.ngZone.run(() => {
              this.initMap();
            });
          });
        });

        return;
      }

      attempts++;

      if (attempts < maximumAttempts) {
        setTimeout(tryInitialize, 50);
      }
    };

    setTimeout(tryInitialize, 0);
  }

  initMap(): void {
    const mapDiv = document.getElementById(
      'restaurantMapPicker'
    );

    if (!mapDiv || typeof L === 'undefined') {
      return;
    }

    /*
     * Prevent duplicate Leaflet initialization.
     */
    if (this.map) {
      this.invalidateMapSize();
      return;
    }

    const latitude =
      this.form.controls.latitude.value ??
      this.defaultLatitude;

    const longitude =
      this.form.controls.longitude.value ??
      this.defaultLongitude;

    this.map = L.map('restaurantMapPicker', {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

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

    this.mapReady = true;

    this.setLatLng(latitude, longitude);

    if (
      this.isEditMode &&
      this.form.controls.location.value
    ) {
      this.mapPickedText =
        this.form.controls.location.value;
    } else {
      this.reverseGeocode(latitude, longitude);
    }

    /*
     * Invalidate at several stages because the map is rendered
     * after the edit form changes from loading to visible.
     */
    this.map.whenReady(() => {
      this.invalidateMapSize();

      setTimeout(() => {
        this.invalidateMapSize();
      }, 100);

      setTimeout(() => {
        this.invalidateMapSize();
      }, 350);

      setTimeout(() => {
        this.invalidateMapSize();
      }, 800);
    });

    this.observeMapSize(mapDiv);
  }

  private observeMapSize(mapDiv: HTMLElement): void {
    this.mapResizeObserver?.disconnect();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.mapResizeObserver = new ResizeObserver(() => {
      this.invalidateMapSize();
    });

    this.mapResizeObserver.observe(mapDiv);
  }

  private invalidateMapSize(): void {
    if (!this.map) {
      return;
    }

    requestAnimationFrame(() => {
      this.map?.invalidateSize({
        pan: false,
        animate: false
      });
    });
  }

  destroyMap(): void {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.mapReady = false;
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.showToast(
        'Geolocation is not supported on this device.',
        'error'
      );

      return;
    }

    this.mapLoading = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        this.map?.setView(
          [latitude, longitude],
          16
        );

        this.setLatLng(latitude, longitude);
        this.reverseGeocode(latitude, longitude);

        this.mapLoading = false;
      },
      () => {
        this.mapLoading = false;

        this.showToast(
          'Unable to access current location. Search or drag the map to pick a location.',
          'error'
        );
      }
    );
  }

  setLatLng(
    latitude: number,
    longitude: number
  ): void {
    this.form.controls.latitude.setValue(
      Number(latitude.toFixed(6))
    );

    this.form.controls.longitude.setValue(
      Number(longitude.toFixed(6))
    );

    this.form.controls.latitude.markAsDirty();
    this.form.controls.longitude.markAsDirty();
  }

  reverseGeocode(
    latitude: number,
    longitude: number
  ): void {
    this.mapLoading = true;

    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}` +
      `&lon=${longitude}&format=json&addressdetails=1`;

    fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    })
      .then((response) => response.json())
      .then((data) => {
        this.mapLoading = false;

        if (data?.display_name) {
          this.mapPickedText = data.display_name;

          this.form.controls.location.setValue(
            data.display_name
          );

          this.form.controls.location.markAsDirty();
        }
      })
      .catch(() => {
        this.mapLoading = false;
      });
  }

  onSearchInput(): void {
    clearTimeout(this.searchDebounceTimer);

    const query = this.searchQuery.trim();

    if (query.length < 3) {
      this.searchResults = [];
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 600);
  }

  performSearch(query: string): void {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=json&addressdetails=1&limit=5`;

    fetch(url, {
      headers: {
        'Accept-Language': 'en'
      }
    })
      .then((response) => response.json())
      .then((data: NominatimResult[]) => {
        this.searchResults = data ?? [];
      })
      .catch(() => {
        this.searchResults = [];

        this.showToast(
          'Unable to search locations. Please try again.',
          'error'
        );
      });
  }

  selectSearchResult(result: NominatimResult): void {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

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

    this.setLatLng(latitude, longitude);

    this.mapPickedText = result.display_name;

    this.form.controls.location.setValue(
      result.display_name
    );

    this.form.controls.location.markAsDirty();

    this.searchQuery = '';
    this.searchResults = [];
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showToast(
        'Please select a valid image file.',
        'error'
      );

      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showToast(
        'Image size must be 5 MB or less.',
        'error'
      );

      input.value = '';
      return;
    }

    this.selectedImage = file;

    const reader = new FileReader();

    reader.onload = () => {
      this.imagePreview = String(reader.result);
    };

    reader.readAsDataURL(file);
  }

  removeSelectedImage(): void {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  saveRestaurant(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving) {
      this.showToast(
        'Please complete the required details and choose a location on the map.',
        'error'
      );

      return;
    }

    this.saving = true;

    const restaurant: Restaurant = {
      name: this.form.controls.name.value.trim(),
      location: this.form.controls.location.value.trim(),
      cuisine: this.form.controls.cuisine.value.trim(),
      isPureVeg: this.form.controls.isPureVeg.value,
      isActive: this.form.controls.isActive.value,
      latitude: this.form.controls.latitude.value,
      longitude: this.form.controls.longitude.value
    };

    if (this.isEditMode && this.restaurantId) {
      this.restaurantService
        .updateAsManager(
          this.restaurantId,
          restaurant
        )
        .subscribe({
          next: (savedRestaurant) => {
            this.uploadImageIfNeeded(
              savedRestaurant.id,
              'Restaurant updated successfully.'
            );
          },

          error: (err) => {
            this.saving = false;

            this.showToast(
              err?.error?.message ||
                'Unable to update restaurant.',
              'error'
            );
          }
        });

      return;
    }

    this.restaurantService
      .createAsManager(restaurant)
      .subscribe({
        next: (savedRestaurant) => {
          this.uploadImageIfNeeded(
            savedRestaurant.id,
            'Restaurant created successfully.'
          );
        },

        error: (err) => {
          this.saving = false;

          this.showToast(
            err?.error?.message ||
              'Unable to create restaurant.',
            'error'
          );
        }
      });
  }

  private uploadImageIfNeeded(
    restaurantId: number | undefined,
    message: string
  ): void {
    if (!restaurantId) {
      this.saving = false;

      this.showToast(
        'Restaurant was saved, but no restaurant ID was returned.',
        'error'
      );

      return;
    }

    if (!this.selectedImage) {
      this.finishSave(message);
      return;
    }

    this.restaurantService
      .uploadRestaurantImageAsManager(
        restaurantId,
        this.selectedImage
      )
      .subscribe({
        next: () => {
          this.finishSave(message);
        },

        error: (err) => {
          this.saving = false;

          this.showToast(
            err?.error?.message ||
              'Restaurant was saved, but image upload failed.',
            'error'
          );
        }
      });
  }

  private finishSave(message: string): void {
    this.saving = false;

    this.showToast(message, 'success');

    setTimeout(() => {
      this.router.navigate([
        '/restaurant-manager/restaurants'
      ]);
    }, 900);
  }

  cancel(): void {
    this.router.navigate([
      '/restaurant-manager/dashboard'
    ]);
  }

  controlInvalid(
    controlName: keyof typeof this.form.controls
  ): boolean {
    const control = this.form.controls[controlName];

    return control.invalid &&
      (control.touched || control.dirty);
  }
}