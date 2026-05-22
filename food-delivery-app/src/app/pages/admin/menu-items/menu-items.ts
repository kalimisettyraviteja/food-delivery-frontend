import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant, MenuItem } from '../../../core/services/restaurant';

@Component({
  selector: 'app-menu-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-items.html',
  styleUrl: './menu-items.css'
})
export class MenuItems implements OnInit {
  private svc = inject(RestaurantService);

  restaurants    = signal<Restaurant[]>([]);
  menuItems      = signal<MenuItem[]>([]);
  selectedRestId: number | null = null;
  selectedRestName = '';
  loading        = signal(false);
  showModal      = false;
  isEdit         = false;
  editId: number | null = null;
  successMsg     = '';
  errorMsg       = '';

  form: MenuItem = { name: '', price: 0, veg: true };

  ngOnInit() {
    this.svc.getAll().subscribe(data => this.restaurants.set(data));
  }

  selectRestaurant(r: Restaurant) {
    this.selectedRestId   = r.id!;
    this.selectedRestName = r.name;
    this.loadMenu();
  }

  loadMenu() {
    if (!this.selectedRestId) return;
    this.loading.set(true);
    this.svc.getMenu(this.selectedRestId).subscribe({
      next:  (data) => { this.menuItems.set(data); this.loading.set(false); },
      error: ()     => this.loading.set(false)
    });
  }

  openAdd() {
    this.form   = { name: '', price: 0, veg: true };
    this.isEdit = false;
    this.showModal = true;
  }

  openEdit(m: MenuItem) {
    this.form   = { ...m };
    this.editId = m.id!;
    this.isEdit = true;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.errorMsg = ''; }

  save() {
    if (!this.form.name || !this.form.price) {
      this.errorMsg = 'Name and price are required.'; return;
    }
    const req = this.isEdit
      ? this.svc.updateMenuItem(this.editId!, this.form)
      : this.svc.addMenuItem(this.selectedRestId!, this.form);

    req.subscribe({
      next: () => {
        this.closeModal(); this.loadMenu();
        this.toast(this.isEdit ? 'Item updated!' : 'Item added!');
      },
      error: () => this.errorMsg = 'Something went wrong.'
    });
  }

  delete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    this.svc.deleteMenuItem(id).subscribe({
      next:  () => { this.loadMenu(); this.toast('Item deleted.'); },
      error: () => this.toast('Delete failed.', true)
    });
  }

  toast(msg: string, isError = false) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 3000);
  }
}