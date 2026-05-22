import { Component, OnInit, inject, signal } from '@angular/core';
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
  loading     = signal(false);
  showModal   = false;
  isEdit      = false;
  editId: number | null = null;
  successMsg  = '';
  errorMsg    = '';

  form: Restaurant = { name: '', location: '', cuisine: '' };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next:  (data) => { this.restaurants.set(data); this.loading.set(false); },
      error: ()     => this.loading.set(false)
    });
  }

  openAdd() {
    this.form  = { name: '', location: '', cuisine: '' };
    this.isEdit = false;
    this.showModal = true;
  }

  openEdit(r: Restaurant) {
    this.form   = { ...r };
    this.editId = r.id!;
    this.isEdit = true;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.errorMsg = ''; }

  save() {
    if (!this.form.name || !this.form.location || !this.form.cuisine) {
      this.errorMsg = 'All fields are required.'; return;
    }
    const req = this.isEdit
      ? this.svc.update(this.editId!, this.form)
      : this.svc.create(this.form);

    req.subscribe({
      next: () => {
        this.closeModal();
        this.loadAll();
        this.showSuccess(this.isEdit ? 'Restaurant updated!' : 'Restaurant added!');
      },
      error: () => this.errorMsg = 'Something went wrong. Try again.'
    });
  }

  delete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    this.svc.delete(id).subscribe({
      next:  () => { this.loadAll(); this.showSuccess('Restaurant deleted.'); },
      error: () => this.showSuccess('Delete failed.', true)
    });
  }

  showSuccess(msg: string, isError = false) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 3000);
  }
}