import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  UserService,
  EmailStatusResponse,
  LoginResponse
} from '../../core/services/user';
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
  | 'RESET_PASSWORD'
  | 'MANAGER_REQUEST'
  | 'REACTIVATION';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    FormsModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly cartService = inject(CartService);

  isLoggedIn = false;
  userName = '';
  role = '';
  profilePhotoUrl = '';

  /*
   * Hides the Home navbar and both offcanvas sections only for:
   * /home/order-tracking/:orderId
   */
  hideHomeChrome = false;

  private routerSubscription: Subscription | null = null;

  authStep: AuthStep = 'EMAIL';

  email = '';
  fullName = '';
  password = '';
  confirmPassword = '';

  managerPhone = '';
  managerRequestSuccess = '';

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
  private otpTimer: ReturnType<typeof setInterval> | null = null;

  /*
   * Reactivation state
   */
  reactivationEmail = '';
  reactivationOtp = '';
  reactivationRequestLoading = false;
  reactivationConfirmLoading = false;
  reactivationStep: 'EMAIL' | 'OTP' = 'EMAIL';
  reactivationError = '';
  reactivationSuccess = '';

  ngOnInit(): void {
    this.syncSessionState();

    if (this.isLoggedIn) {
      this.loadProfilePhoto();
    }

    /*
     * Apply visibility immediately for a direct URL refresh,
     * such as http://localhost:4200/home/order-tracking/18.
     */
    this.updateHomeChromeVisibility(this.router.url);

    /*
     * Update visibility whenever navigation finishes.
     */
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateHomeChromeVisibility(event.urlAfterRedirects);
      }
    });

    const authOffcanvas = document.getElementById(
      'authOffcanvas'
    );

    if (authOffcanvas) {
      authOffcanvas.addEventListener(
        'shown.bs.offcanvas',
        this.handleAuthShown
      );

      authOffcanvas.addEventListener(
        'hidden.bs.offcanvas',
        this.handleAuthHidden
      );
    }
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.routerSubscription = null;

    this.clearProfilePhotoUrl();
    this.clearOtpTimer();

    const authOffcanvas = document.getElementById(
      'authOffcanvas'
    );

    if (authOffcanvas) {
      authOffcanvas.removeEventListener(
        'shown.bs.offcanvas',
        this.handleAuthShown
      );

      authOffcanvas.removeEventListener(
        'hidden.bs.offcanvas',
        this.handleAuthHidden
      );
    }

    document.body.classList.remove('auth-offcanvas-open');
  }

  private handleAuthShown = (): void => {
    document.body.classList.add('auth-offcanvas-open');
  };

  private handleAuthHidden = (): void => {
    document.body.classList.remove('auth-offcanvas-open');
  };

  private syncSessionState(): void {
    this.isLoggedIn = this.userService.isLoggedIn();
    this.userName = this.userService.getUserName();
    this.role = this.userService.getRole() || '';
  }

  /*
   * Hide navbar only on:
   * /home/order-tracking/18
   * /home/order-tracking/18?from=orders
   */
  private updateHomeChromeVisibility(url: string): void {
    this.hideHomeChrome =
      /^\/home\/order-tracking\/[^/?#]+/.test(url);
  }

  private getOffcanvasInstance(id: string): any {
    const element = document.getElementById(id);

    return element
      ? bootstrap.Offcanvas.getOrCreateInstance(element)
      : null;
  }

  openAuthOffcanvas(): void {
    this.resetAuthState(true);
    this.authStep = 'EMAIL';
    this.getOffcanvasInstance('authOffcanvas')?.show();
  }

  closeAuthOffcanvas(): void {
    this.getOffcanvasInstance('authOffcanvas')?.hide();
  }

  /*
   * OTP timer
   */
  private startOtpTimer(durationInSeconds = 600): void {
    this.clearOtpTimer();

    this.otpCountdown = durationInSeconds;
    this.canResendOtp = false;
    this.updateOtpDisplay();

    this.otpTimer = setInterval(() => {
      if (this.otpCountdown > 0) {
        this.otpCountdown--;
        this.updateOtpDisplay();
        return;
      }

      this.canResendOtp = true;
      this.clearOtpTimer();
    }, 1000);
  }

  private clearOtpTimer(): void {
    if (!this.otpTimer) {
      return;
    }

    clearInterval(this.otpTimer);
    this.otpTimer = null;
  }

  private updateOtpDisplay(): void {
    const minutes = Math.floor(this.otpCountdown / 60);
    const seconds = this.otpCountdown % 60;

    this.otpDisplayTime =
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`;
  }

  /*
   * General state helpers
   */
  private resetMessages(): void {
    this.authError = '';
    this.authSuccess = '';
    this.otpError = '';
    this.otpSuccess = '';
    this.forgotError = '';
    this.success = '';
    this.managerRequestSuccess = '';
    this.reactivationError = '';
    this.reactivationSuccess = '';
  }

  private resetAuthState(clearEmail = true): void {
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

    this.managerPhone = '';

    this.reactivationEmail = '';
    this.reactivationOtp = '';
    this.reactivationStep = 'EMAIL';
    this.reactivationRequestLoading = false;
    this.reactivationConfirmLoading = false;

    this.clearOtpTimer();
    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;

    if (clearEmail) {
      this.email = '';
    }
  }

  /*
   * Navigation between auth steps
   */
  goToRegisterDirect(): void {
    this.resetMessages();

    this.authStep = 'REGISTER';
    this.registerContext = 'REGISTER';

    this.email = '';
    this.fullName = '';
    this.password = '';
    this.confirmPassword = '';
  }

  openManagerRequestStep(): void {
    this.resetMessages();

    this.authStep = 'MANAGER_REQUEST';

    this.fullName = '';
    this.password = '';
    this.confirmPassword = '';
    this.managerPhone = '';
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
    const existingEmail = this.email || this.reactivationEmail;

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

    this.authStep =
      this.registerContext === 'PENDING_VERIFICATION'
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

  /*
   * Session and profile photo
   */
  private logoutAndGoHome(): void {
    this.clearProfilePhotoUrl();
    this.userService.logout();
    this.cartService.clearCart();
    this.syncSessionState();
    this.resetAuthState(true);

    this.router.navigate(['/home/main']);
  }

  loadProfilePhoto(): void {
    this.userService.getProfile().subscribe({
      next: profile => {
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
    if (!this.profilePhotoUrl) {
      return;
    }

    URL.revokeObjectURL(this.profilePhotoUrl);
    this.profilePhotoUrl = '';
  }

  /*
   * Email-first flow
   */
  checkEmail(): void {
    const normalizedEmail = this.email.trim();

    if (!normalizedEmail) {
      this.authError = 'Email is required.';
      return;
    }

    this.loading = true;
    this.resetMessages();

    this.userService.checkEmailStatus({
      email: normalizedEmail
    }).subscribe({
      next: (response: EmailStatusResponse) => {
        this.loading = false;

        this.email = response.email || normalizedEmail;
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

        this.password = '';
        this.confirmPassword = '';

        if (response.nextStep === 'REACTIVATION') {
          this.openReactivationFlow(
            response.email || normalizedEmail
          );
          return;
        }

        if (response.nextStep === 'LOGIN') {
          this.authStep = 'LOGIN';
          this.fullName = '';
          this.pendingVerification = false;
          return;
        }

        if (response.nextStep === 'PENDING_VERIFICATION') {
          this.authStep = 'PENDING_VERIFICATION';
          this.registerContext = 'PENDING_VERIFICATION';
          this.fullName = response.name || '';
          this.pendingVerification = true;
          return;
        }

        this.authStep = 'REGISTER';
        this.registerContext = 'REGISTER';
        this.fullName = '';
        this.pendingVerification = false;
      },

      error: error => {
        this.loading = false;
        this.authError =
          error?.error?.message ||
          'Unable to continue. Please try again.';
      }
    });
  }

  /*
   * Normal active-account login
   */
  signIn(): void {
    this.loading = true;
    this.authError = '';

    this.userService.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: (response: LoginResponse) => {
        this.loading = false;

        this.userService.setSession(response);
        this.syncSessionState();

        this.closeAuthOffcanvas();
        this.resetAuthState(true);

        if (response.mustChangePassword !== true) {
          this.loadProfilePhoto();
        }

        this.navigateAfterAuthentication(response);
      },

      error: error => {
        this.loading = false;

        const rawMessage =
          error?.error?.message ||
          'Invalid credentials.';

        if (rawMessage.toLowerCase().includes('deactivated')) {
          this.openReactivationFlow(this.email);
          return;
        }

        this.authError = rawMessage;
      }
    });
  }

  private navigateAfterAuthentication(response: LoginResponse): void {
    if (response.mustChangePassword === true) {
      this.router.navigate(['/must-change-password']);
      return;
    }

    switch (response.role) {
      case 'ADMIN':
        this.router.navigate(['/admin']);
        break;

      case 'RESTAURANT_MANAGER':
        this.router.navigate(['/restaurant-manager']);
        break;

      case 'USER':
      default:
        this.router.navigate(['/home/main']);
        break;
    }
  }

  /*
   * Registration
   */
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
      this.authError =
        'Password and confirm password do not match.';
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

        this.authSuccess =
          message || 'Verification OTP sent successfully.';

        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';

        this.verificationOtpSent = true;

        this.startOtpTimer(600);
        this.authStep = 'VERIFY_OTP';
      },

      error: error => {
        this.loading = false;

        this.authError =
          error?.error?.message ||
          'Unable to send verification OTP.';
      }
    });
  }

  submitManagerRequest(): void {
    if (!this.email.trim()) {
      this.authError = 'Email is required.';
      return;
    }

    if (!this.fullName.trim()) {
      this.authError = 'Name is required.';
      return;
    }

    if (!this.managerPhone.trim()) {
      this.authError = 'Phone is required.';
      return;
    }

    this.loading = true;
    this.authError = '';
    this.managerRequestSuccess = '';

    this.userService.submitManagerRequest({
      name: this.fullName,
      email: this.email,
      phone: this.managerPhone
    }).subscribe({
      next: (message: string) => {
        this.loading = false;

        this.managerRequestSuccess =
          message ||
          'Manager registration request submitted successfully.';
      },

      error: error => {
        this.loading = false;

        this.authError =
          error?.error?.message ||
          'Unable to submit manager request.';
      }
    });
  }

  resendVerificationOtp(): void {
    if (!this.canResendOtp) {
      return;
    }

    this.loading = true;
    this.authError = '';
    this.otpError = '';

    this.userService.resendVerificationOtp({
      email: this.email
    }).subscribe({
      next: (message: string) => {
        this.loading = false;

        this.authSuccess = message || 'OTP resent successfully.';
        this.otp = '';
        this.otpError = '';
        this.otpSuccess = '';
        this.verificationOtpSent = true;

        this.startOtpTimer(600);
      },

      error: error => {
        this.loading = false;

        this.otpError =
          error?.error?.message ||
          'Unable to resend OTP.';
      }
    });
  }

  verifyEmailAndCreateAccount(): void {
    this.loading = true;
    this.otpError = '';
    this.otpSuccess = '';

    this.userService.verifyEmail({
      email: this.email,
      otp: this.otp
    }).subscribe({
      next: (response: LoginResponse) => {
        this.loading = false;

        this.emailVerified = true;
        this.otpSuccess =
          'Account created successfully. Signing you in...';

        this.clearOtpTimer();
        this.verificationOtpSent = false;

        this.userService.setSession(response);
        this.syncSessionState();

        setTimeout(() => {
          this.closeAuthOffcanvas();

          if (response.mustChangePassword !== true) {
            this.loadProfilePhoto();
          }

          this.resetAuthState(true);
          this.navigateAfterAuthentication(response);
        }, 1200);
      },

      error: error => {
        this.loading = false;

        this.otpError =
          error?.error?.message ||
          'Invalid or expired OTP. Please try again.';
      }
    });
  }

  /*
   * Forgot password
   */
  sendOtp(): void {
    if (!this.forgotEmail.trim()) {
      this.forgotError = 'Email is required.';
      return;
    }

    this.loading = true;
    this.forgotError = '';
    this.success = '';

    this.userService.forgotPassword({
      email: this.forgotEmail.trim()
    }).subscribe({
      next: (message?: string) => {
        this.loading = false;

        this.success =
          message ||
          'If the account exists, a password reset OTP has been sent.';

        this.authStep = 'FORGOT_OTP';
        this.startOtpTimer(600);
      },

      error: error => {
        this.loading = false;

        this.forgotError =
          error?.error?.message ||
          'Unable to send OTP.';
      }
    });
  }

  verifyOtp(): void {
    this.loading = true;
    this.forgotError = '';

    this.userService.verifyResetOtp({
      email: this.forgotEmail,
      otp: this.forgotOtp
    }).subscribe({
      next: () => {
        this.loading = false;
        this.authStep = 'RESET_PASSWORD';
        this.clearOtpTimer();
      },

      error: error => {
        this.loading = false;

        this.forgotError =
          error?.error?.message ||
          'Invalid or expired OTP. Please try again.';
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

        this.success =
          'Password reset successful! Please sign in.';

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

      error: error => {
        this.loading = false;

        this.forgotError =
          error?.error?.message ||
          'Something went wrong. Please try again.';
      }
    });
  }

  resendOtp(): void {
    if (!this.canResendOtp) {
      return;
    }

    this.forgotOtp = '';
    this.forgotError = '';
    this.success = '';

    this.sendOtp();
  }

  /*
   * Account reactivation
   */
  private openReactivationFlow(email: string): void {
    this.clearOtpTimer();

    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;

    this.password = '';
    this.confirmPassword = '';

    this.reactivationEmail = email.trim();
    this.reactivationOtp = '';
    this.reactivationStep = 'EMAIL';
    this.reactivationError = '';
    this.reactivationSuccess =
      'This account is deactivated. Send an OTP to reactivate it.';

    this.authStep = 'REACTIVATION';
  }

  sendReactivationOtp(): void {
    const normalizedEmail = this.reactivationEmail.trim();

    if (!normalizedEmail) {
      this.reactivationError = 'Email is required.';
      return;
    }

    this.reactivationRequestLoading = true;
    this.reactivationError = '';
    this.reactivationSuccess = '';

    this.userService
      .requestAccountReactivation(normalizedEmail)
      .subscribe({
        next: (message: string) => {
          this.reactivationRequestLoading = false;

          this.reactivationEmail = normalizedEmail;
          this.reactivationOtp = '';
          this.reactivationStep = 'OTP';

          this.reactivationSuccess =
            message ||
            'If the account is deactivated, an OTP has been sent.';

          this.startOtpTimer(600);
        },

        error: error => {
          this.reactivationRequestLoading = false;

          this.reactivationError =
            error?.error?.message ||
            'Unable to send reactivation OTP.';
        }
      });
  }

  confirmReactivation(): void {
    const normalizedEmail = this.reactivationEmail.trim();
    const normalizedOtp = this.reactivationOtp.trim();

    if (!normalizedEmail) {
      this.reactivationError = 'Email is required.';
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      this.reactivationError = 'Enter a valid 6-digit OTP.';
      return;
    }

    this.reactivationConfirmLoading = true;
    this.reactivationError = '';
    this.reactivationSuccess = '';

    this.userService.confirmAccountReactivation({
      email: normalizedEmail,
      otp: normalizedOtp
    }).subscribe({
      next: (response: LoginResponse) => {
        this.reactivationConfirmLoading = false;

        this.clearOtpTimer();

        this.reactivationSuccess =
          'Account reactivated successfully. Signing you in...';

        this.userService.setSession(response);
        this.syncSessionState();

        setTimeout(() => {
          this.closeAuthOffcanvas();

          if (response.mustChangePassword !== true) {
            this.loadProfilePhoto();
          }

          this.resetAuthState(true);
          this.navigateAfterAuthentication(response);
        }, 1200);
      },

      error: error => {
        this.reactivationConfirmLoading = false;

        this.reactivationError =
          error?.error?.message ||
          'Unable to reactivate account. Please try again.';
      }
    });
  }

  backFromReactivationOtp(): void {
    if (
      this.reactivationRequestLoading ||
      this.reactivationConfirmLoading
    ) {
      return;
    }

    this.clearOtpTimer();
    this.otpCountdown = 0;
    this.otpDisplayTime = '10:00';
    this.canResendOtp = false;

    this.reactivationOtp = '';
    this.reactivationError = '';
    this.reactivationSuccess = '';
    this.reactivationStep = 'EMAIL';
  }

  /*
   * Logout
   */
  logout(): void {
    this.logoutAndGoHome();
  }
}