import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MenuItem,
  Restaurant,
  RestaurantService
} from '../../../core/services/restaurant';

declare const bootstrap: any;

interface MenuItemSnapshot {
  name: string;
  description: string;
  price: number;
  veg: boolean;
  isAvailable: boolean;
}

@Component({
  selector: 'app-manager-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manager-menu.html',
  styleUrl: './manager-menu.css'
})
export class ManagerMenu implements OnInit {
  private restaurantService = inject(RestaurantService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  restaurantId = 0;
  restaurant: Restaurant | null = null;

  loadingRestaurant = false;
  loadingMenu = false;
  savingMenuItem = false;
  deletingMenuItem = false;

  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];

  searchTerm = '';
  availabilityFilter: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE' = 'ALL';
  foodTypeFilter: 'ALL' | 'VEG' | 'NON_VEG' = 'ALL';

  editingMenuItemId: number | null = null;
  selectedMenuImage: File | null = null;
  menuImagePreview: string | null = null;
  existingMenuImage: string | null = null;

  menuItemToDelete: MenuItem | null = null;

  openActionId: number | null = null;
  activeActionItem: MenuItem | null = null;
  actionMenuTop = 0;
  actionMenuLeft = 0;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private toastTimer: any;
  private menuItemModal: any;
  private deleteModal: any;

  private initialMenuItemValue: MenuItemSnapshot = {
    name: '',
    description: '',
    price: 0,
    veg: true,
    isAvailable: true
  };

  readonly menuItemForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    price: [0, [Validators.required, Validators.min(1)]],
    veg: [true],
    isAvailable: [true]
  });

  get isEditMode(): boolean {
    return this.editingMenuItemId !== null;
  }

  get pageTitle(): string {
    return this.restaurant?.name
      ? `${this.restaurant.name} menu`
      : 'Restaurant menu';
  }

  get availableCount(): number {
    return this.menuItems.filter((item) => item.isAvailable !== false).length;
  }

  get unavailableCount(): number {
    return this.menuItems.length - this.availableCount;
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit menu item' : 'Add menu item';
  }

  get modalSubtitle(): string {
    return this.isEditMode
      ? 'Update item details, price, availability or image.'
      : `Add a new dish to ${this.restaurant?.name || 'this restaurant'}.`;
  }

  get submitLabel(): string {
    if (this.savingMenuItem) {
      return this.isEditMode ? 'Saving...' : 'Adding...';
    }

    return this.isEditMode ? 'Save changes' : 'Add item';
  }

  get showLoading(): boolean {
    return this.loadingRestaurant || this.loadingMenu;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('restaurantId'));

      if (!Number.isFinite(id) || id <= 0) {
        this.showToast('Invalid restaurant selected.', 'error');
        this.goBack();
        return;
      }

      this.restaurantId = id;

      this.loadRestaurant();
      this.loadMenuItems();

      setTimeout(() => {
        this.initializeModals();
      }, 0);
    });
  }

  initializeModals(): void {
    const menuModalElement = document.getElementById('menuItemModal');
    const deleteModalElement = document.getElementById('deleteMenuItemModal');

    if (menuModalElement && !this.menuItemModal) {
      this.menuItemModal = new bootstrap.Modal(menuModalElement);

      menuModalElement.addEventListener('hidden.bs.modal', () => {
        this.resetMenuItemForm();
      });
    }

    if (deleteModalElement && !this.deleteModal) {
      this.deleteModal = new bootstrap.Modal(deleteModalElement);

      deleteModalElement.addEventListener('hidden.bs.modal', () => {
        if (!this.deletingMenuItem) {
          this.menuItemToDelete = null;
        }
      });
    }
  }

  loadRestaurant(): void {
    this.loadingRestaurant = true;

    this.restaurantService.getMyRestaurantById(this.restaurantId).subscribe({
      next: (restaurant) => {
        this.restaurant = restaurant;
        this.loadingRestaurant = false;
      },
      error: (err) => {
        this.loadingRestaurant = false;

        this.showToast(
          err?.error?.message || 'Unable to load restaurant details.',
          'error'
        );
      }
    });
  }

  loadMenuItems(): void {
    this.loadingMenu = true;
    this.closeActions();

    this.restaurantService.getManagerMenuItems(this.restaurantId).subscribe({
      next: (items) => {
        this.menuItems = items ?? [];
        this.applyFilters();
        this.loadingMenu = false;
      },
      error: (err) => {
        this.loadingMenu = false;

        this.showToast(
          err?.error?.message || 'Unable to load menu items.',
          'error'
        );
      }
    });
  }

  refresh(): void {
    this.loadRestaurant();
    this.loadMenuItems();
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredMenuItems = this.menuItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        String(item.description ?? '').toLowerCase().includes(search);

      const isAvailable = item.isAvailable !== false;

      const matchesAvailability =
        this.availabilityFilter === 'ALL' ||
        (this.availabilityFilter === 'AVAILABLE' && isAvailable) ||
        (this.availabilityFilter === 'UNAVAILABLE' && !isAvailable);

      const matchesFoodType =
        this.foodTypeFilter === 'ALL' ||
        (this.foodTypeFilter === 'VEG' && item.veg) ||
        (this.foodTypeFilter === 'NON_VEG' && !item.veg);

      return matchesSearch && matchesAvailability && matchesFoodType;
    });

    this.closeActions();
  }

  setAvailabilityFilter(
    filter: 'ALL' | 'AVAILABLE' | 'UNAVAILABLE'
  ): void {
    this.availabilityFilter = filter;
    this.applyFilters();
  }

  setFoodTypeFilter(filter: 'ALL' | 'VEG' | 'NON_VEG'): void {
    this.foodTypeFilter = filter;
    this.applyFilters();
  }

  openAddMenuItemModal(): void {
    if (!this.restaurant?.isActive) {
      this.showToast(
        'This restaurant is inactive. Activate it before adding menu items.',
        'error'
      );
      return;
    }

    this.closeActions();
    this.resetMenuItemForm();

    if (!this.menuItemModal) {
      this.initializeModals();
    }

    this.menuItemModal?.show();
  }

  openEditMenuItemModal(item: MenuItem): void {
    this.closeActions();

    if (!item.id) {
      return;
    }

    this.editingMenuItemId = item.id;

    this.menuItemForm.patchValue({
      name: item.name ?? '',
      description: item.description ?? '',
      price: item.price ?? 0,
      veg: item.veg ?? true,
      isAvailable: item.isAvailable !== false
    });

    this.initialMenuItemValue = {
      name: (item.name ?? '').trim(),
      description: (item.description ?? '').trim(),
      price: Number(item.price ?? 0),
      veg: item.veg ?? true,
      isAvailable: item.isAvailable !== false
    };

    this.existingMenuImage = item.image ?? null;
    this.selectedMenuImage = null;
    this.menuImagePreview = null;

    this.menuItemForm.markAsPristine();
    this.menuItemForm.markAsUntouched();

    if (!this.menuItemModal) {
      this.initializeModals();
    }

    this.menuItemModal?.show();
  }

  resetMenuItemForm(): void {
    this.editingMenuItemId = null;
    this.selectedMenuImage = null;
    this.menuImagePreview = null;
    this.existingMenuImage = null;

    this.menuItemForm.reset({
      name: '',
      description: '',
      price: 0,
      veg: true,
      isAvailable: true
    });

    this.initialMenuItemValue = {
      name: '',
      description: '',
      price: 0,
      veg: true,
      isAvailable: true
    };

    this.menuItemForm.markAsPristine();
    this.menuItemForm.markAsUntouched();
  }

  onMenuImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file.', 'error');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image size must be 5 MB or less.', 'error');
      input.value = '';
      return;
    }

    this.selectedMenuImage = file;
    this.menuItemForm.markAsDirty();

    const reader = new FileReader();

    reader.onload = () => {
      this.menuImagePreview = String(reader.result);
    };

    reader.readAsDataURL(file);
  }

  removeSelectedMenuImage(): void {
    this.selectedMenuImage = null;
    this.menuImagePreview = null;
    this.menuItemForm.markAsDirty();
  }

  hasMenuItemChanges(): boolean {
    if (!this.isEditMode) {
      return true;
    }

    if (this.selectedMenuImage) {
      return true;
    }

    const current = this.menuItemForm.getRawValue();

    return (
      current.name.trim() !== this.initialMenuItemValue.name ||
      current.description.trim() !== this.initialMenuItemValue.description ||
      Number(current.price) !== this.initialMenuItemValue.price ||
      current.veg !== this.initialMenuItemValue.veg ||
      current.isAvailable !== this.initialMenuItemValue.isAvailable
    );
  }

  canSaveMenuItem(): boolean {
    if (this.savingMenuItem || this.menuItemForm.invalid) {
      return false;
    }

    return !this.isEditMode || this.hasMenuItemChanges();
  }

  saveMenuItem(): void {
    this.menuItemForm.markAllAsTouched();

    if (!this.canSaveMenuItem()) {
      return;
    }

    this.savingMenuItem = true;

    const value = this.menuItemForm.getRawValue();

    const item: MenuItem = {
      restaurantId: this.restaurantId,
      name: value.name.trim(),
      description: value.description.trim(),
      price: Number(value.price),
      veg: value.veg,
      isAvailable: value.isAvailable
    };

    if (this.isEditMode && this.editingMenuItemId) {
      this.restaurantService
        .updateMenuItemAsManager(this.editingMenuItemId, item)
        .subscribe({
          next: (savedItem) => {
            this.uploadMenuImageIfNeeded(
              savedItem.id,
              'Menu item updated successfully.'
            );
          },
          error: (err) => {
            this.savingMenuItem = false;

            this.showToast(
              err?.error?.message || 'Unable to update menu item.',
              'error'
            );
          }
        });

      return;
    }

    this.restaurantService
      .addMenuItemAsManager(this.restaurantId, item)
      .subscribe({
        next: (savedItem) => {
          this.uploadMenuImageIfNeeded(
            savedItem.id,
            'Menu item added successfully.'
          );
        },
        error: (err) => {
          this.savingMenuItem = false;

          this.showToast(
            err?.error?.message || 'Unable to add menu item.',
            'error'
          );
        }
      });
  }

  private uploadMenuImageIfNeeded(
    itemId: number | undefined,
    message: string
  ): void {
    if (!itemId) {
      this.savingMenuItem = false;

      this.showToast(
        'Menu item was saved, but no item ID was returned.',
        'error'
      );
      return;
    }

    if (!this.selectedMenuImage) {
      this.finishMenuItemSave(message);
      return;
    }

    this.restaurantService
      .uploadMenuItemImageAsManager(itemId, this.selectedMenuImage)
      .subscribe({
        next: () => this.finishMenuItemSave(message),
        error: (err) => {
          this.savingMenuItem = false;

          this.showToast(
            err?.error?.message ||
              'Menu item was saved, but image upload failed.',
            'error'
          );
        }
      });
  }

  private finishMenuItemSave(message: string): void {
    this.savingMenuItem = false;
    this.menuItemModal?.hide();

    this.showToast(message, 'success');
    this.loadMenuItems();
  }

  askDeleteMenuItem(item: MenuItem): void {
    this.closeActions();

    if (!item.id) {
      return;
    }

    this.menuItemToDelete = item;

    if (!this.deleteModal) {
      this.initializeModals();
    }

    this.deleteModal?.show();
  }

  confirmDeleteMenuItem(): void {
    if (!this.menuItemToDelete?.id || this.deletingMenuItem) {
      return;
    }

    const itemId = this.menuItemToDelete.id;

    this.deletingMenuItem = true;

    this.restaurantService.deleteMenuItemAsManager(itemId).subscribe({
      next: () => {
        this.deletingMenuItem = false;
        this.deleteModal?.hide();

        this.menuItems = this.menuItems.filter(
          (item) => item.id !== itemId
        );

        this.applyFilters();

        this.showToast(
          'Menu item deleted successfully.',
          'success'
        );
      },
      error: (err) => {
        this.deletingMenuItem = false;

        this.showToast(
          err?.error?.message || 'Unable to delete menu item.',
          'error'
        );
      }
    });
  }

  toggleActions(id: number | undefined, event: MouseEvent): void {
    event.stopPropagation();

    if (!id) {
      return;
    }

    if (this.openActionId === id) {
      this.closeActions();
      return;
    }

    const item = this.menuItems.find((menuItem) => menuItem.id === id);

    if (!item) {
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const buttonRect = button.getBoundingClientRect();

    const menuWidth = 155;
    const menuHeight = 92;
    const margin = 8;

    let left = buttonRect.right - menuWidth;
    let top = buttonRect.bottom + 5;

    if (top + menuHeight > window.innerHeight - margin) {
      top = buttonRect.top - menuHeight - 5;
    }

    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - menuWidth - margin)
    );

    this.activeActionItem = item;
    this.openActionId = id;
    this.actionMenuTop = top;
    this.actionMenuLeft = left;
  }

  @HostListener('document:click')
  closeActions(): void {
    this.openActionId = null;
    this.activeActionItem = null;
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  closeActionOnViewportChange(): void {
    this.closeActions();
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }

  getItemImage(item: MenuItem): string | null {
    return item.image ?? null;
  }

  getRestaurantImage(): string | null {
    return this.restaurant?.image ?? null;
  }

  goBack(): void {
    this.router.navigate(['/restaurant-manager/restaurants']);
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;

    clearTimeout(this.toastTimer);

    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
    }, 3500);
  }

  trackByMenuItemId(_: number, item: MenuItem): number | undefined {
    return item.id;
  }
}