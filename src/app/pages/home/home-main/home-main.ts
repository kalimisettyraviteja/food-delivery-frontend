import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RestaurantService, Restaurant } from '../../../core/services/restaurant';
import { UserService } from '../../../core/services/user';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
declare var bootstrap: any;

@Component({
  selector: 'app-home-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-main.html',
  styleUrl: './home-main.css'
})
export class HomeMain implements OnInit, OnDestroy {
  private svc = inject(RestaurantService);
  private router = inject(Router);
  private userService = inject(UserService);

  @ViewChild('signInToast') signInToastRef!: ElementRef;

  restaurants = signal<Restaurant[]>([]);
  filtered = signal<Restaurant[]>([]);
  loading = signal(true);

  searchText = '';
  isLoggedIn = false;
  private toastInstance: any;
  private authSub!: Subscription;

  ngOnInit() {
    // Subscribe to live auth state — updates instantly when user logs in/out
    this.authSub = this.userService.isLoggedIn$.subscribe(state => {
      this.isLoggedIn = state;
      this.applyRestaurantView();
    });

    this.svc.getAll().subscribe({
      next: (data) => {
        this.restaurants.set(data);
        this.applyRestaurantView();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  ngAfterViewInit() {
    if (this.signInToastRef?.nativeElement) {
      this.toastInstance = new bootstrap.Toast(this.signInToastRef.nativeElement, {
        autohide: true,
        delay: 2500
      });
    }
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  onSearch() {
    this.applyRestaurantView();
  }

  applyRestaurantView() {
    const q = this.searchText.trim().toLowerCase();
    const data = this.restaurants();

    if (!this.isLoggedIn) {
      this.filtered.set(
        !q ? data : data.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q)
        )
      );
      return;
    }

    this.filtered.set(
      !q
        ? data.filter(r => r.isActive)
        : data.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q)
        )
    );
  }

  showSignInToast() {
    if (this.toastInstance) {
      this.toastInstance.show();
    }
  }

  getOfferText(r: Restaurant): string {
    const rating = Number(r.rating);
    const deliveryTime = Number(r.deliveryTime);

    if (!isNaN(rating) && rating >= 4.7 && !isNaN(deliveryTime) && deliveryTime <= 25) {
      return 'Top rated • Fast delivery';
    }

    if (!isNaN(rating) && rating >= 4.5) {
      return 'Customer favourite';
    }

    if (!isNaN(deliveryTime) && deliveryTime <= 20) {
      return 'Delivers in 20 mins';
    }

    if (!isNaN(deliveryTime) && deliveryTime <= 30) {
      return 'Quick bites delivered fast';
    }

    if (r.cuisine?.trim()) {
      return `${r.cuisine} special`;
    }

    return 'Fresh food near you';
  }


  getRestaurantImage(r: any): string {
    return r.imageUrl || r.image || r.photo || r.bannerImage || r.coverImage || '';
  }

  hasRestaurantImage(r: any): boolean {
    return !!this.getRestaurantImage(r).trim();
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) parent.classList.add('image-failed');
  }

  openRestaurant(r: Restaurant) {
    if (!this.isLoggedIn) {
      this.showSignInToast();
      return;
    }
    if (!r.isActive) return;
    this.router.navigate(['/home/restaurant', r.id]);
  }
}