import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ChangePasswordRequest,
  UserService
} from '../../core/services/user';

@Component({
  selector: 'app-must-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './must-change-password.html',
  styleUrl: './must-change-password.css'
})
export class MustChangePassword {
  private userService = inject(UserService);
  private router = inject(Router);

  newPassword = '';
  confirmPassword = '';

  loading = false;
  errorMessage = '';
  successMessage = '';

  get passwordsMatch(): boolean {
    return (
      this.newPassword.length > 0 &&
      this.confirmPassword.length > 0 &&
      this.newPassword === this.confirmPassword
    );
  }

  get formValid(): boolean {
    return (
      this.newPassword.trim().length >= 4 &&
      this.confirmPassword.trim().length >= 4 &&
      this.passwordsMatch
    );
  }

  changePassword(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newPassword.trim()) {
      this.errorMessage = 'New password is required.';
      return;
    }

    if (!this.confirmPassword.trim()) {
      this.errorMessage = 'Confirm password is required.';
      return;
    }

    if (this.newPassword.length < 4) {
      this.errorMessage = 'Password must be at least 4 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New password and confirm password do not match.';
      return;
    }

    this.loading = true;

    const request: ChangePasswordRequest = {
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    };

    this.userService.changePassword(request).subscribe({
      next: (message) => {
        this.loading = false;
        this.successMessage =
          message || 'Password changed successfully.';

        this.userService.clearMustChangePassword();

        setTimeout(() => {
          this.navigateByRole();
        }, 700);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message ||
          'Unable to change password. Please try again.';
      }
    });
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/home/main']);
  }

  private navigateByRole(): void {
    const role = this.userService.getRole();

    switch (role) {
      case 'ADMIN':
        this.router.navigate(['/admin']);
        break;

      case 'RESTAURANT_MANAGER':
        this.router.navigate(['/restaurant-manager']);
        break;

      case 'USER':
        this.router.navigate(['/home/main']);
        break;

      default:
        this.router.navigate(['/home/main']);
        break;
    }
  }
}