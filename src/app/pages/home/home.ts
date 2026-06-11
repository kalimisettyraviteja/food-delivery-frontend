import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { UserService } from '../../core/services/user';
import { CartService } from '../../core/services/cart';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  private router = inject(Router);
  private userService = inject(UserService);
  private cartService = inject(CartService);

  isLoggedIn = false;
  userName = '';
  role = '';
  profilePhotoUrl = '';

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('token');
    this.userName = localStorage.getItem('userName') || '';
    this.role = localStorage.getItem('role') || '';

    if (this.isLoggedIn) {
      this.loadProfilePhoto();
    }
  }

  ngOnDestroy(): void {
    this.clearProfilePhotoUrl();
  }

  loadProfilePhoto(): void {
    this.userService.getProfile().subscribe({
      next: (profile) => {
        if (!profile?.id || !profile?.profilePhotoUrl) {
          this.clearProfilePhotoUrl();
          return;
        }

        this.userService.getProfilePhotoBlob(profile.id).subscribe({
          next: (blob: Blob) => {
            this.clearProfilePhotoUrl();
            this.profilePhotoUrl = URL.createObjectURL(blob);
          },
          error: () => {
            this.clearProfilePhotoUrl();
          }
        });
      },
      error: () => {
        this.clearProfilePhotoUrl();
      }
    });
  }

  clearProfilePhotoUrl(): void {
    if (this.profilePhotoUrl) {
      URL.revokeObjectURL(this.profilePhotoUrl);
      this.profilePhotoUrl = '';
    }
  }

  logout(): void {
    this.clearProfilePhotoUrl();
    this.userService.logout();
    this.cartService.clearCart();
    this.router.navigate(['/login']);
  }
}