import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService, EmailStatusResponse, LoginResponse } from '../../core/services/user';
import { CartService } from '../../core/services/cart';

declare const bootstrap: any;

type AuthStep =
  | 'EMAIL'
  | 'LOGIN'
  | 'REGISTER'
  | 'PENDING_VERIFICATION'
  | 'VERIFY_OTP'
  | 'FORGOT_EMAIL'
  | 'FORGOT_OTP'
  | 'RESET_PASSWORD';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, FormsModule],
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

  authStep: AuthStep = 'EMAIL';

  email = '';
  fullName = '';
  password = '';
  confirmPassword = '';

  emailChecked = false;
  emailVerified = false;
  pendingVerification = false;
  verificationOtpSent = false;
  registerContext: 'REGISTER' | 'PENDING_VERIFICATION' = 'REGISTER';

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
  forgotError = '';
  success = '';

  otpCountdown = 0;
  otpDisplayTime = '10:00';
  canResendOtp = false;
  private otpTimer: any = null;

  ngOnInit(): void {
    this.syncSessionState();

    if (this.isLoggedIn) {
      this.loadProfilePhoto();
    }

    const authOffcanvas = document.getElementById('authOffcanvas');
    if (authOffcanvas) {
      authOffcanvas.addEventListener('shown.bs.offcanvas', this.handleAuthShown);
      authOffcanvas.addEventListener('hidden.bs.offcanvas', this.handleAuthHidden);
    }
  }

  ngOnDestroy(): void {
    this.clearProfilePhotoUrl();
    this.clearOtpTimer();

    const authOffcanvas = document.getElementById('authOffcanvas');
    if (authOffcanvas) {
      authOffcanvas.removeEventListener('shown.bs.offcanvas', this.handleAuthShown);
      authOffcanvas.removeEventListener('hidden.bs.offcanvas', this.handleAuthHidden);
    }

    document.body.classList.remove('auth-offcanvas-open');
  }

  private handleAuthShown = () => {
    document.body.classList.add('auth-offcanvas-open');
  };

  private handleAuthHidden = () => {
    document.body.classList.remove('auth-offcanvas-open');
  };

  private syncSessionState(): void {
    this.isLoggedIn = this.userService.isLoggedIn();
    this.userName = this.userService.getUserName();
    this.role = this.userService.getRole() || '';
  }

  private getOffcanvasInstance(id: string) {
    const el = document.getElementById(id);
    return el ? bootstrap.Offcanvas.getOrCreateInstance(el) : null;
  }

  openAuthOffcanvas(): void {
    this.resetAuthState(true);
    this.authStep = 'EMAIL';
    this.getOffcanvasInstance('authOffcanvas')?.show();
  }

  closeAuthOffcanvas(): void {
    this.getOffcanvasInstance('authOffcanvas')?.hide();
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

  private resetMessages(): void {
    this.authError = '';
    this.authSuccess = '';
    this.otpError = '';
    this.otpSuccess = '';
    this.forgotError = '';
    this.success = '';
  }

  private resetAuthState(clearEmail: boolean = true): void {
    this.authStep = 'EMAIL';
    this.emailChecked = false;
    this.emailVerified = false;
    this.pendingVerification = false;
    this.verificationOtpSent = false;
    this.registerContext = 'REGISTER';
    this.loading = false;
    this.resetMessages();

    this.fullName = '';
    this.password = '';
    this.confirmPassword = '';
    this.otp = '';
    this.forgotEmail = '';
    this.forgotOtp = '';
    this.newPassword = '';
    this.forgotConfirmPassword = '';

    this.clearOtpTimer();
    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;

    if (clearEmail) {
      this.email = '';
    }
  }

  goToRegisterDirect(): void {
    this.resetMessages();
    this.authStep = 'REGISTER';
    this.registerContext = 'REGISTER';
    this.email = '';
    this.fullName = '';
    this.password = '';
    this.confirmPassword = '';
  }

  switchToRegister(): void {
    this.resetMessages();
    this.password = '';
    this.confirmPassword = '';
    this.authStep = 'REGISTER';
    this.registerContext = 'REGISTER';
  }

  switchToLogin(): void {
    this.resetMessages();
    this.password = '';
    this.confirmPassword = '';
    this.authStep = 'LOGIN';
  }

  goBackToEmail(): void {
    const existingEmail = this.email;
    this.resetAuthState(false);
    this.authStep = 'EMAIL';
    this.email = existingEmail;
  }

  openExistingOtpStep(): void {
    this.resetMessages();
    this.authStep = 'VERIFY_OTP';
  }

  backFromOtp(): void {
    this.resetMessages();
    this.authStep = this.registerContext === 'PENDING_VERIFICATION'
      ? 'PENDING_VERIFICATION'
      : 'REGISTER';
  }

  startForgotPassword(): void {
    this.resetMessages();
    this.forgotEmail = this.email || '';
    this.forgotOtp = '';
    this.newPassword = '';
    this.forgotConfirmPassword = '';
    this.clearOtpTimer();
    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;
    this.authStep = 'FORGOT_EMAIL';
  }

  backToForgotEmail(): void {
    this.resetMessages();
    this.forgotOtp = '';
    this.clearOtpTimer();
    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;
    this.authStep = 'FORGOT_EMAIL';
  }

  backToForgotOtp(): void {
    this.resetMessages();
    this.authStep = 'FORGOT_OTP';
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

  checkEmail(): void {
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
        this.otpCountdown = 0;
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
          this.registerContext = 'PENDING_VERIFICATION';
          this.fullName = res.name || '';
          this.password = '';
          this.confirmPassword = '';
          this.pendingVerification = true;
        } else {
          this.authStep = 'REGISTER';
          this.registerContext = 'REGISTER';
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

  signIn(): void {
    this.loading = true;
    this.authError = '';

    this.userService.login({ email: this.email, password: this.password }).subscribe({
      next: (res: LoginResponse) => {
        this.loading = false;
        this.userService.setSession(res);
        this.syncSessionState();
        this.userService.emitAuthChange(true);   // ← ADD THIS
        this.closeAuthOffcanvas();
        this.loadProfilePhoto();
        this.resetAuthState(true);

        if (res.role === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/home']);
        }
        
      },
      error: (err) => {
        this.authError = err.error?.message || 'Invalid credentials.';
        this.loading = false;
      }
    });
  }

  sendRegistrationOtp(): void {
    if (!this.email.trim()) {
      this.authError = 'Email is required.';
      return;
    }

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
      next: (message: string) => {
        this.loading = false;
        this.authSuccess = message || 'Verification OTP sent successfully.';
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.verificationOtpSent = true;
        this.startOtpTimer(600);
        this.authStep = 'VERIFY_OTP';
      },
      error: (err) => {
        this.authError = err.error?.message || 'Unable to send verification OTP.';
        this.loading = false;
      }
    });
  }

  resendVerificationOtp(): void {
    if (!this.canResendOtp) return;

    this.loading = true;
    this.authError = '';
    this.otpError = '';

    this.userService.resendVerificationOtp({ email: this.email }).subscribe({
      next: (message: string) => {
        this.loading = false;
        this.authSuccess = message || 'OTP resent successfully.';
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.verificationOtpSent = true;
        this.startOtpTimer(600);
      },
      error: (err) => {
        this.otpError = err.error?.message || 'Unable to resend OTP.';
        this.loading = false;
      }
    });
  }

  verifyEmailAndCreateAccount(): void {
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
        this.syncSessionState();
        //this.userService.emitAuthChange(true);   // ← ADD THIS


        setTimeout(() => {
          this.closeAuthOffcanvas();
          this.loadProfilePhoto();
          this.resetAuthState(true);
        }, 1200);
      },
      error: (err) => {
        this.otpError = err.error?.message || 'Invalid or expired OTP. Please try again.';
        this.loading = false;
      }
    });
  }

  sendOtp(): void {
    this.loading = true;
    this.forgotError = '';
    this.success = '';

    this.userService.forgotPassword({ email: this.forgotEmail }).subscribe({
      next: () => {
        this.loading = false;
        this.authStep = 'FORGOT_OTP';
        this.startOtpTimer(600);
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Unable to send OTP.';
        this.loading = false;
      }
    });
  }

  verifyOtp(): void {
    this.loading = true;
    this.forgotError = '';

    this.userService.verifyResetOtp({ email: this.forgotEmail, otp: this.forgotOtp }).subscribe({
      next: () => {
        this.loading = false;
        this.authStep = 'RESET_PASSWORD';
        this.clearOtpTimer();
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Invalid or expired OTP. Please try again.';
        this.loading = false;
      }
    });
  }

  resetPassword(): void {
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

        setTimeout(() => {
          this.password = '';
          this.confirmPassword = '';
          this.otp = '';
          this.forgotOtp = '';
          this.newPassword = '';
          this.forgotConfirmPassword = '';
          this.authStep = 'LOGIN';
          this.email = this.forgotEmail;
          this.forgotEmail = '';
          this.success = '';
        }, 1200);
      },
      error: (err) => {
        this.forgotError = err.error?.message || 'Something went wrong. Please try again.';
        this.loading = false;
      }
    });
  }

  resendOtp(): void {
    if (!this.canResendOtp) return;

    this.forgotOtp = '';
    this.forgotError = '';
    this.success = '';
    this.sendOtp();
  }

  logout(): void {
    this.clearProfilePhotoUrl();
    this.userService.logout();
    this.cartService.clearCart();
    this.syncSessionState();
    this.userService.emitAuthChange(false);   // ← ADD THIS
    this.resetAuthState(true);
    this.router.navigate(['/home/main']);
  }
}