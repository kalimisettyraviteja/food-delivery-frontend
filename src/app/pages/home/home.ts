import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RestaurantService, Restaurant } from '../../core/services/restaurant';
import { UserService } from '../../core/services/user';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  private svc = inject(RestaurantService);
  private router = inject(Router);
  private userService = inject(UserService);

  restaurants = signal<Restaurant[]>([]);
  filtered = signal<Restaurant[]>([]);
  loading = signal(true);

  searchText = '';
  isLoggedIn = false;
  userName = '';
  role = '';

  ngOnInit() {
    this.isLoggedIn = !!localStorage.getItem('role');
    this.userName = localStorage.getItem('userName') || '';
    this.role = localStorage.getItem('role') || '';

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
    let data = this.restaurants();

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

  logout() {
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}