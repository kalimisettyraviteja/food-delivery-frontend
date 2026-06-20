import { Component, inject, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService, EmailStatusResponse, LoginResponse } from '../../core/services/user';

declare const bootstrap: any;

type AuthStep = 'EMAIL' | 'LOGIN' | 'REGISTER' | 'PENDING_VERIFICATION';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnDestroy {
  private userService = inject(UserService);
  private router = inject(Router);

  authStep: AuthStep = 'EMAIL';

  email = '';
  fullName = '';
  password = '';
  confirmPassword = '';

  emailChecked = false;
  emailVerified = false;
  pendingVerification = false;
  verificationOtpSent = false;

  loading = false;
  authError = '';
  authSuccess = '';

  otp = '';
  otpError = '';
  otpSuccess = '';

  forgotEmail = '';
  forgotOtp = '';
  newPassword = '';
  forgotConfirmPassword = '';
  currentStep = 1;
  forgotError = '';
  success = '';

  otpCountdown = 0;
  otpDisplayTime = '10:00';
  canResendOtp = false;
  private otpTimer: any = null;

  ngOnDestroy(): void {
    this.clearOtpTimer();
  }

  private startOtpTimer(durationInSeconds: number = 600): void {
    this.clearOtpTimer();
    this.otpCountdown = durationInSeconds;
    this.canResendOtp = false;
    this.updateOtpDisplay();

    this.otpTimer = setInterval(() => {
      if (this.otpCountdown > 0) {
        this.otpCountdown--;
        this.updateOtpDisplay();
      } else {
        this.canResendOtp = true;
        this.clearOtpTimer();
      }
    }, 1000);
  }

  private clearOtpTimer(): void {
    if (this.otpTimer) {
      clearInterval(this.otpTimer);
      this.otpTimer = null;
    }
  }

  private updateOtpDisplay(): void {
    const minutes = Math.floor(this.otpCountdown / 60);
    const seconds = this.otpCountdown % 60;
    this.otpDisplayTime =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  openVerificationModal() {
    const modalEl = document.getElementById('verifyEmailModal');
    const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
    modal?.show();
  }

  checkEmail() {
    this.loading = true;
    this.authError = '';
    this.authSuccess = '';

    this.userService.checkEmailStatus({ email: this.email }).subscribe({
      next: (res: EmailStatusResponse) => {
        this.loading = false;
        this.emailChecked = true;
        this.emailVerified = false;
        this.verificationOtpSent = false;
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.clearOtpTimer();
        this.otpDisplayTime = '10:00';
        this.canResendOtp = false;

        if (res.nextStep === 'LOGIN') {
          this.authStep = 'LOGIN';
          this.fullName = '';
          this.password = '';
          this.confirmPassword = '';
          this.pendingVerification = false;
        } else if (res.nextStep === 'PENDING_VERIFICATION') {
          this.authStep = 'PENDING_VERIFICATION';
          this.fullName = res.name || '';
          this.password = '';
          this.confirmPassword = '';
          this.pendingVerification = true;
        } else {
          this.authStep = 'REGISTER';
          this.fullName = '';
          this.password = '';
          this.confirmPassword = '';
          this.pendingVerification = false;
        }
      },
      error: (err) => {
        this.authError = err.error?.message || 'Unable to continue. Please try again.';
        this.loading = false;
      }
    });
  }

  goBackToEmail() {
    this.authStep = 'EMAIL';
    this.emailChecked = false;
    this.emailVerified = false;
    this.pendingVerification = false;
    this.verificationOtpSent = false;
    this.authError = '';
    this.authSuccess = '';
    this.password = '';
    this.confirmPassword = '';
    this.fullName = '';
    this.otp = '';
    this.otpError = '';
    this.otpSuccess = '';
    this.clearOtpTimer();
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;
  }

  signIn() {
    this.loading = true;
    this.authError = '';

    this.userService.login({ email: this.email, password: this.password }).subscribe({
      next: (res: LoginResponse) => {
        this.loading = false;
        this.userService.setSession(res);
        this.redirectByRole(res.role);
      },
      error: (err) => {
        this.authError = err.error?.message || 'Invalid credentials.';
        this.loading = false;
      }
    });
  }

  sendRegistrationOtp() {
    if (!this.fullName.trim()) {
      this.authError = 'Full name is required.';
      return;
    }

    if (this.password.length < 6) {
      this.authError = 'Password must be at least 6 characters.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.authError = 'Password and confirm password do not match.';
      return;
    }

    this.loading = true;
    this.authError = '';

    this.userService.register({
      name: this.fullName,
      email: this.email,
      password: this.password,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (message) => {
        this.loading = false;
        this.authSuccess = message || 'Verification OTP sent successfully.';
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.verificationOtpSent = true;
        this.startOtpTimer(600);
        this.openVerificationModal();
      },
      error: (err) => {
        this.authError = err.error?.message || 'Unable to send verification OTP.';
        this.loading = false;
      }
    });
  }

  resendVerificationOtp() {
    if (!this.canResendOtp) return;

    this.loading = true;
    this.authError = '';
    this.otpError = '';

    this.userService.resendVerificationOtp({ email: this.email }).subscribe({
      next: (message) => {
        this.loading = false;
        this.authSuccess = message || 'OTP resent successfully.';
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.verificationOtpSent = true;
        this.startOtpTimer(600);
        this.openVerificationModal();
      },
      error: (err) => {
        this.authError = err.error?.message || 'Unable to resend OTP.';
        this.loading = false;
      }
    });
  }

  verifyEmailAndCreateAccount() {
    this.loading = true;
    this.otpError = '';
    this.otpSuccess = '';

    this.userService.verifyEmail({ email: this.email, otp: this.otp }).subscribe({
      next: (res: LoginResponse) => {
        this.loading = false;
        this.emailVerified = true;
        this.otpSuccess = 'Account created successfully. Signing you in...';
        this.clearOtpTimer();
        this.verificationOtpSent = false;
        this.userService.setSession(res);

        const modalEl = document.getElementById('verifyEmailModal');
        const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;

        setTimeout(() => {
          modal?.hide();
          this.redirectByRole(res.role);
        }, 1200);
      },
      error: (err) => {
        this.otpError = err.error?.message || 'Invalid or expired OTP. Please try again.';
        this.loading = false;
      }
    });
  }

  redirectByRole(role: string) {
    if (role === 'ADMIN') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/home']);
    }
  }

  openForgotModal() {
    this.currentStep = 1;
    this.forgotEmail = this.email || '';
    this.forgotOtp = '';
    this.newPassword = '';
    this.forgotConfirmPassword = '';
    this.forgotError = '';
    this.success = '';
    this.clearOtpTimer();
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;
  }

  sendOtp() {
    this.loading = true;
    this.forgotError = '';
    this.success = '';

    this.userService.forgotPassword({ email: this.forgotEmail }).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 2;
        this.startOtpTimer(600);
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Unable to send OTP.';
        this.loading = false;
      }
    });
  }

  verifyOtp() {
    this.loading = true;
    this.forgotError = '';

    this.userService.verifyResetOtp({ email: this.forgotEmail, otp: this.forgotOtp }).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 3;
        this.clearOtpTimer();
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Invalid or expired OTP. Please try again.';
        this.loading = false;
      }
    });
  }

  resetPassword() {
    if (this.newPassword !== this.forgotConfirmPassword) {
      this.forgotError = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.forgotError = '';
    this.success = '';

    this.userService.resetPassword({
      email: this.forgotEmail,
      otp: this.forgotOtp,
      newPassword: this.newPassword,
      confirmPassword: this.forgotConfirmPassword
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password reset successful! Please sign in.';
        this.clearOtpTimer();

        const modalEl = document.getElementById('forgotPasswordModal');
        const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;

        setTimeout(() => {
          modal?.hide();
          this.openForgotModal();
        }, 1500);
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Something went wrong. Please try again.';
        this.loading = false;
      }
    });
  }

  resendOtp() {
    if (!this.canResendOtp) return;

    this.forgotOtp = '';
    this.forgotError = '';
    this.success = '';
    this.sendOtp();
  }
}