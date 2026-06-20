import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/services/user';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  constructor(private userService: UserService, private router: Router) {}

  // Step control
  currentStep = 1;

  // Step 1
  email = '';

  // Step 2
  otp = '';

  // Step 3
  newPassword = '';
  confirmPassword = '';

  loading = false;
  error = '';
  success = '';

  // Step 1 - Send OTP
  sendOtp() {
    this.loading = true;
    this.error = '';
    this.userService.forgotPassword({ email: this.email }).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 2;
      },
      error: (err) => {
        this.error = err.error?.message || 'Something went wrong. Please try again.';
        this.loading = false;
      }
    });
  }

  // Step 2 - Verify OTP
  verifyOtp() {
    this.loading = true;
    this.error = '';
    this.userService.verifyResetOtp({ email: this.email, otp: this.otp }).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 3;
      },
      error: (err) => {
        this.error = err.error?.message || 'Invalid OTP. Please try again.';
        this.loading = false;
      }
    });
  }

  // Step 3 - Reset Password
  resetPassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.userService.resetPassword({
      email: this.email,
      otp: this.otp,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password reset successful! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Something went wrong. Please try again.';
        this.loading = false;
      }
    });
  }
}