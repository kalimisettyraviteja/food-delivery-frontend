import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant } from '../../../core/services/restaurant';

@Component({
  selector: 'app-restaurants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurants.html',
  styleUrl: './restaurants.css'
})
export class Restaurants implements OnInit {
  private svc = inject(RestaurantService);

  restaurants = signal<Restaurant[]>([]);
  searchText = signal('');
  loading = signal(false);

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

  private addErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private addSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  private editErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private editSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  form: Restaurant = {
    name: '',
    location: '',
    cuisine: '',
    deliveryTime: 0,
    isActive: true,
    image: null
  };

  filteredRestaurants = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    const list = this.restaurants();
    if (!term) return list;
    return list.filter(r =>
      (r.name ?? '').toLowerCase().includes(term) ||
      (r.location ?? '').toLowerCase().includes(term) ||
      (r.cuisine ?? '').toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadAll();
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
    this.addErrorTimer = setTimeout(() => {
      this.addErrorMsg = '';
    }, 2000);
  }

  private showAddSuccess(msg: string) {
    this.clearTimer(this.addSuccessTimer);
    this.addSuccessMsg = msg;
    this.addSuccessTimer = setTimeout(() => {
      this.addSuccessMsg = '';
    }, 2000);
  }

  private showEditError(msg: string) {
    this.clearTimer(this.editErrorTimer);
    this.editErrorMsg = msg;
    this.editErrorTimer = setTimeout(() => {
      this.editErrorMsg = '';
    }, 2000);
  }

  private showEditSuccess(msg: string) {
    this.clearTimer(this.editSuccessTimer);
    this.editSuccessMsg = msg;
    this.editSuccessTimer = setTimeout(() => {
      this.editSuccessMsg = '';
    }, 2000);
  }

  private showToast(msg: string) {
    this.clearTimer(this.toastTimer);
    this.successMsg = msg;
    this.toastTimer = setTimeout(() => {
      this.successMsg = '';
    }, 2000);
  }

  loadAll() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (data) => {
        this.restaurants.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearchChange() {
    this.searchText.set(this.searchText());
  }

  openAdd() {
    this.form = {
      name: '',
      location: '',
      cuisine: '',
      deliveryTime: 0,
      isActive: true,
      image: null
    };
    this.addErrorMsg = '';
    this.addSuccessMsg = '';
    this.showAddModal = true;
    this.showEditModal = false;
    this.editId = null;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.addErrorMsg = '';
    this.addSuccessMsg = '';
    this.clearTimer(this.addErrorTimer);
    this.clearTimer(this.addSuccessTimer);
  }

  openEdit(r: Restaurant) {
    this.form = {
      id: r.id,
      name: r.name,
      location: r.location,
      cuisine: r.cuisine,
      rating: r.rating ?? 0,
      ratingCount: r.ratingCount ?? 0,
      deliveryTime: r.deliveryTime ?? 0,
      isActive: r.isActive ?? true,
      image: r.image ?? null
    };
    this.editId = r.id!;
    this.selectedImageFile = null;
    this.imagePreview = r.image ?? null;
    this.editErrorMsg = '';
    this.editSuccessMsg = '';
    this.showEditModal = true;
    this.showAddModal = false;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editErrorMsg = '';
    this.editSuccessMsg = '';
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.clearTimer(this.editErrorTimer);
    this.clearTimer(this.editSuccessTimer);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.selectedImageFile = input.files[0];
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = reader.result as string;
    reader.readAsDataURL(this.selectedImageFile);
  }

  saveRestaurantDetails() {
    if (!this.form.name || !this.form.location || !this.form.cuisine) {
      const msg = 'Name, Location and Cuisine are required.';
      if (this.showAddModal) this.showAddError(msg);
      if (this.showEditModal) this.showEditError(msg);
      return;
    }

    const payload: Restaurant = {
      name: this.form.name,
      location: this.form.location,
      cuisine: this.form.cuisine,
      deliveryTime: this.form.deliveryTime,
      isActive: this.form.isActive
    };

    const req = this.editId
      ? this.svc.update(this.editId, payload)
      : this.svc.create(payload);

    req.subscribe({
      next: (saved) => {
        this.loadAll();

        if (this.editId) {
          this.editId = saved.id!;
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