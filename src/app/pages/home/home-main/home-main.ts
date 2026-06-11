import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant } from '../../../core/services/restaurant';

@Component({
  selector: 'app-home-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-main.html',
  styleUrl: './home-main.css'
})
export class HomeMain implements OnInit {
  private svc = inject(RestaurantService);
  private router = inject(Router);

  restaurants = signal<Restaurant[]>([]);
  filtered = signal<Restaurant[]>([]);
  loading = signal(true);

  searchText = '';
  isLoggedIn = false;

  ngOnInit() {
    this.isLoggedIn = !!localStorage.getItem('role');

    this.svc.getAll().subscribe({
      next: (data) => {
        this.restaurants.set(data);
        this.applyRestaurantView();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    this.applyRestaurantView();
  }

  applyRestaurantView() {
    const q = this.searchText.trim().toLowerCase();
    const data = this.restaurants();

    if (!this.isLoggedIn) {
      if (!q) {
        this.filtered.set(data);
      } else {
        this.filtered.set(
          data.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.cuisine.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q)
          )
        );
      }
      return;
    }

    if (!q) {
      this.filtered.set(data.filter(r => r.isActive));
      return;
    }

    this.filtered.set(
      data.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      )
    );
  }

  openRestaurant(r: Restaurant) {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (!r.isActive) {
      return;
    }

    this.router.navigate(['/restaurant', r.id]);
  }
}