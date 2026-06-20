import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant, MenuItem } from '../../../core/services/restaurant';
declare var bootstrap: any;

@Component({
  selector: 'app-menu-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-items.html',
  styleUrl: './menu-items.css'
})
export class MenuItems implements OnInit {
  private svc = inject(RestaurantService);

  @ViewChild('restaurantScroller') restaurantScroller!: ElementRef<HTMLDivElement>;

  restaurants = signal<Restaurant[]>([]);
  filteredRestaurants = signal<Restaurant[]>([]);
  menuItems = signal<MenuItem[]>([]);
  displayedMenuItems = signal<MenuItem[]>([]);
  restaurantsLoading = signal(true);

  selectedRestId: number | null = null;
  selectedRestName = '';
  loading = signal(false);

  editId: number | null = null;
  successMsg = '';
  errorMsg = '';

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  readonly MAX_IMAGE_SIZE = 6 * 1024 * 1024;


  restaurantSearchText = '';
  searchText = '';
  vegFilter: 'all' | 'veg' | 'nonveg' = 'all';

  restaurantsPerPage = 5;
  currentRestaurantPage = 1;

  private successTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  private addModalInstance: any;
  private editModalInstance: any;

  form: MenuItem = {
    name: '',
    description: '',
    price: 0,
    veg: true,
    isAvailable: true,
    image: null
  };

  ngOnInit() {
    this.restaurantsLoading.set(true);
    this.svc.getAll().subscribe({
      next: (data: Restaurant[]) => {
        this.restaurants.set(data);
        this.filteredRestaurants.set(data);
        this.restaurantsLoading.set(false);
      },
      error: (err) => {
        this.restaurantsLoading.set(false);
        this.showToastError(this.getErrorMessage(err));
      }
    });
  }

  private getModal(id: string) {
    const el = document.getElementById(id);
    if (!el) return null;
    return bootstrap.Modal.getOrCreateInstance(el);
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

  private showToast(msg: string) {
    this.clearTimer(this.successTimer);
    this.successMsg = msg;
    this.successTimer = setTimeout(() => (this.successMsg = ''), 2000);
  }

  private showToastError(msg: string) {
    this.clearTimer(this.errorTimer);
    this.errorMsg = msg;
    this.errorTimer = setTimeout(() => (this.errorMsg = ''), 2000);
  }

  private blurActiveElement() {
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  }

  selectRestaurant(r: Restaurant) {
    this.selectedRestId = r.id!;
    this.selectedRestName = r.name;
    this.loadMenu();
  }

  loadMenu() {
    if (!this.selectedRestId) return;
    this.loading.set(true);
    this.svc.getAdminMenuItems(this.selectedRestId).subscribe({
      next: (data: MenuItem[]) => {
        this.menuItems.set(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showToastError(this.getErrorMessage(err));
      }
    });
  }

  openAdd() {
    this.form = { name: '', description: '', price: 0, veg: true, isAvailable: true, image: null };
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.errorMsg = '';
    this.getModal('addMenuItemModal')?.show();
  }

  openEdit(m: MenuItem) {
    this.form = {
      id: m.id,
      restaurantId: m.restaurantId,
      name: m.name,
      description: m.description ?? '',
      price: m.price,
      veg: m.veg,
      image: m.image ?? null,
      isAvailable: m.isAvailable ?? true
    };
    this.editId = m.id!;
    this.selectedImageFile = null;
    this.imagePreview = m.image ?? null;
    this.errorMsg = '';
    this.getModal('editMenuItemModal')?.show();
  }

  closeAddModal() {
    this.blurActiveElement();
    this.errorMsg = '';
    this.clearTimer(this.errorTimer);
    this.getModal('addMenuItemModal')?.hide();
  }

  closeEditModal() {
    this.blurActiveElement();
    this.errorMsg = '';
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.clearTimer(this.errorTimer);
    this.getModal('editMenuItemModal')?.hide();
  }

  onRestaurantSearch() {
    const q = this.restaurantSearchText.trim().toLowerCase();
    const data = this.restaurants();
    this.filteredRestaurants.set(
      !q
        ? data
        : data.filter(
          r =>
            r.name.toLowerCase().includes(q) ||
            r.cuisine.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q)
        )
    );
    this.currentRestaurantPage = 1;
  }

  private validateImageSize(file: File): boolean {
    if (file.size > this.MAX_IMAGE_SIZE) {
      this.showToastError('Image must be 6 MB or less.');
      return false;
    }
    return true;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (!this.validateImageSize(file)) {
      input.value = '';
      this.selectedImageFile = null;
      this.imagePreview = null;
      return;
    }

    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.imagePreview = reader.result as string);
    reader.readAsDataURL(this.selectedImageFile);
  }

  save() {
    if (!this.form.name || !this.form.price || !this.selectedRestId) {
      this.showToastError('Name and price are required.');
      return;
    }
    const payload: MenuItem = {
      name: this.form.name,
      description: this.form.description,
      price: this.form.price,
      veg: this.form.veg,
      isAvailable: this.form.isAvailable
    };
    this.svc.addMenuItem(this.selectedRestId, payload).subscribe({
      next: () => { this.closeAddModal(); this.loadMenu(); this.showToast('Item added!'); },
      error: (err) => this.showToastError(this.getErrorMessage(err))
    });
  }

  update() {
    if (!this.form.name || !this.form.price || !this.editId) {
      this.showToastError('Name and price are required.');
      return;
    }
    const payload: MenuItem = {
      name: this.form.name,
      description: this.form.description,
      price: this.form.price,
      veg: this.form.veg,
      isAvailable: this.form.isAvailable
    };
    this.svc.updateMenuItem(this.editId, payload).subscribe({
      next: () => { this.closeEditModal(); this.loadMenu(); this.showToast('Item updated!'); },
      error: (err) => this.showToastError(this.getErrorMessage(err))
    });
  }



  uploadMenuItemImage(itemId: number) {
    if (!this.selectedImageFile) {
      this.showToastError('Please select an image first.');
      return;
    }

    if (this.selectedImageFile.size > this.MAX_IMAGE_SIZE) {
      this.showToastError('Image must be 6 MB or less.');
      return;
    }

    this.svc.uploadMenuItemImage(itemId, this.selectedImageFile).subscribe({
      next: () => {
        this.loadMenu();
        this.showToast('Image updated successfully.');
        this.closeEditModal();
      },
      error: (err) => this.showToastError(this.getErrorMessage(err))
    });
  }

  deleteMenuItemImage(itemId: number) {
    this.svc.deleteMenuItemImage(itemId).subscribe({
      next: () => { this.loadMenu(); this.showToast('Image removed.'); },
      error: (err) => this.showToastError(this.getErrorMessage(err))
    });
  }

  delete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    this.svc.deleteMenuItem(id).subscribe({
      next: () => { this.loadMenu(); this.showToast('Item deleted.'); },
      error: (err) => this.showToastError(this.getErrorMessage(err))
    });
  }

  setFilter(filter: 'all' | 'veg' | 'nonveg') {
    this.vegFilter = filter;
    this.applyFilters();
  }

  onSearch() { this.applyFilters(); }

  filteredMenuItems() { return this.displayedMenuItems(); }

  applyFilters() {
    const q = this.searchText.trim().toLowerCase();
    const base = this.menuItems();
    const filtered = base.filter(m => {
      const matchText = !q || m.name.toLowerCase().includes(q) || (m.description ?? '').toLowerCase().includes(q);
      const matchVeg = this.vegFilter === 'all' || (this.vegFilter === 'veg' && m.veg) || (this.vegFilter === 'nonveg' && !m.veg);
      return matchText && matchVeg;
    });
    this.displayedMenuItems.set([...filtered]);
  }

  get totalRestaurantPages(): number {
    return Math.ceil(this.filteredRestaurants().length / this.restaurantsPerPage);
  }

  get paginatedRestaurants(): Restaurant[] {
    const start = (this.currentRestaurantPage - 1) * this.restaurantsPerPage;
    const end = start + this.restaurantsPerPage;
    return this.filteredRestaurants().slice(start, end);
  }

  shortName(name: string): string {
    return name?.trim() || 'Restaurant';
  }

  goToRestaurantPage(page: number | string) {
    if (page === '...') return;
    const p = Number(page);
    if (Number.isNaN(p) || p < 1 || p > this.totalRestaurantPages) return;
    this.currentRestaurantPage = p;
  }

  nextRestaurantPage() {
    if (this.currentRestaurantPage < this.totalRestaurantPages) this.currentRestaurantPage++;
  }

  prevRestaurantPage() {
    if (this.currentRestaurantPage > 1) this.currentRestaurantPage--;
  }

  get visibleRestaurantPages(): (number | string)[] {
    const total = this.totalRestaurantPages;
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (this.currentRestaurantPage <= 2) return [1, 2, 3, 4, '...', total];
    if (this.currentRestaurantPage >= total - 1) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', this.currentRestaurantPage - 1, this.currentRestaurantPage, this.currentRestaurantPage + 1, '...', total];
  }
}
