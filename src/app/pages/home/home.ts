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
  private svc    = inject(RestaurantService);
  private router = inject(Router);
  private userService = inject(UserService);

  restaurants = signal<Restaurant[]>([]);
  filtered    = signal<Restaurant[]>([]);
  loading     = signal(true);
  searchText  = '';
  isLoggedIn  = false;
  userName    = '';
  role = '';  

  ngOnInit() {
    this.isLoggedIn = !!localStorage.getItem('role');
    this.userName   = localStorage.getItem('userName') || '';
    this.role       = localStorage.getItem('role') || '';

    this.svc.getAll().subscribe({
      next: (data) => {
          this.restaurants.set(data);
          this.filtered.set(data);
          this.loading.set(false); 
        },
      error: ()     => this.loading.set(false)
    });
  }

  onSearch() {
    const q = this.searchText.toLowerCase();
    this.filtered.set(
      this.restaurants().filter(r =>
        r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.location.toLowerCase().includes(q)
      )
    );
  }

  openRestaurant(id: number) {
    if (this.isLoggedIn) {
      this.router.navigate(['/restaurant', id]);
    } else {
      this.router.navigate(['/login']);
    }
  }

  logout() {
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}