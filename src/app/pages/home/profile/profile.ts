import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserResponse,
  UserService
} from '../../../core/services/user';
import { Home } from '../home';

declare const bootstrap: any;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly home = inject(Home);

  @ViewChild('fileInput')
  fileInputRef!: ElementRef<HTMLInputElement>;

  @ViewChild('statusToast')
  statusToastRef!: ElementRef<HTMLDivElement>;

  profile: UserResponse | null = null;

  form: UpdateProfileRequest = {
    name: '',
    phone: ''
  };

  passwordForm: ChangePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  uploadedPhotoBlobUrl: string | null = null;

  loading = false;
  saving = false;
  uploading = false;
  removing = false;
  changingPassword = false;
  showChangePassword = false;

  /* =================================================
     Account deactivation state
     ================================================= */

  deactivating = false;
  confirmingDeactivate = false;
  resendingDeactivateOtp = false;

  deactivateOtp = '';

  deactivationOtpCountdown = 0;
  deactivationOtpDisplayTime = '10:00';
  canResendDeactivateOtp = false;

  private deactivationOtpTimer:
    | ReturnType<typeof setInterval>
    | null = null;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.clearBlobUrl();
    this.clearDeactivationOtpTimer();
  }

  get accountStatusClass(): string {
    const status = this.profile?.accountStatus || 'ACTIVE';
    return `status-${String(status).toLowerCase()}`;
  }

  get canDeactivate(): boolean {
    return this.profile?.accountStatus === 'ACTIVE';
  }

  get displayPhoto(): string {
    if (this.previewUrl) {
      return this.previewUrl;
    }

    if (this.uploadedPhotoBlobUrl) {
      return this.uploadedPhotoBlobUrl;
    }

    return '';
  }

  get hasSavedPhoto(): boolean {
    return !!this.profile?.profilePhotoUrl;
  }

  /* =================================================
     General UI helpers
     ================================================= */

  toggleChangePassword(): void {
    this.showChangePassword = !this.showChangePassword;

    if (!this.showChangePassword) {
      this.passwordForm = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
    }
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;

    setTimeout(() => {
      if (!this.statusToastRef?.nativeElement) {
        return;
      }

      const toastElement = this.statusToastRef.nativeElement;

      const toast = bootstrap.Toast.getOrCreateInstance(
        toastElement,
        {
          delay: 3000,
          autohide: true
        }
      );

      toast.show();
    });
  }

  openFilePicker(): void {
    this.fileInputRef?.nativeElement.click();
  }

  /* =================================================
     Profile
     ================================================= */

  loadProfile(): void {
    this.loading = true;

    this.userService.getProfile().subscribe({
      next: response => {
        this.profile = response;

        this.form = {
          name: response.name,
          phone: response.phone
        };

        this.selectedFile = null;
        this.previewUrl = null;

        this.loadSavedPhoto();
        this.loading = false;
      },

      error: error => {
        this.loading = false;

        this.showToast(
          error?.error?.message || 'Failed to load profile.',
          'error'
        );
      }
    });
  }

  loadSavedPhoto(): void {
    if (!this.profile?.id || !this.profile?.profilePhotoUrl) {
      this.clearBlobUrl();
      return;
    }

    this.userService
      .getProfilePhotoBlob(this.profile.id)
      .subscribe({
        next: blob => {
          this.clearBlobUrl();
          this.uploadedPhotoBlobUrl = URL.createObjectURL(blob);
        },

        error: () => {
          this.clearBlobUrl();
        }
      });
  }

  clearBlobUrl(): void {
    if (!this.uploadedPhotoBlobUrl) {
      return;
    }

    URL.revokeObjectURL(this.uploadedPhotoBlobUrl);
    this.uploadedPhotoBlobUrl = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    const file =
      input.files && input.files.length > 0
        ? input.files[0]
        : null;

    if (!file) {
      this.selectedFile = null;
      this.previewUrl = null;
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.selectedFile = null;
      this.previewUrl = null;

      this.showToast(
        'Only JPG, PNG, and WEBP images are allowed.',
        'error'
      );

      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();

    reader.onload = () => {
      this.previewUrl = reader.result as string;
    };

    reader.readAsDataURL(file);
  }

  saveProfile(): void {
    this.saving = true;

    this.userService.updateProfile(this.form).subscribe({
      next: response => {
        localStorage.setItem('userName', response.name);

        this.profile = response;

        this.form.name = response.name;
        this.form.phone = response.phone;

        this.saving = false;

        this.showToast(
          'Profile updated successfully.',
          'success'
        );
      },

      error: error => {
        this.saving = false;

        this.showToast(
          error?.error?.message ||
          'Failed to update profile.',
          'error'
        );
      }
    });
  }

  uploadPhoto(): void {
    if (!this.selectedFile) {
      this.showToast(
        'Please select an image first.',
        'error'
      );

      return;
    }

    this.uploading = true;

    this.userService
      .uploadProfilePhoto(this.selectedFile)
      .subscribe({
        next: response => {
          this.profile = response;
          this.selectedFile = null;
          this.previewUrl = null;

          if (this.fileInputRef?.nativeElement) {
            this.fileInputRef.nativeElement.value = '';
          }

          this.uploading = false;

          this.loadSavedPhoto();

          this.showToast(
            'Profile photo uploaded successfully.',
            'success'
          );
        },

        error: error => {
          this.uploading = false;

          this.showToast(
            error?.error?.message ||
            'Failed to upload profile photo.',
            'error'
          );
        }
      });
  }

  removePhoto(): void {
    this.removing = true;

    this.userService.removeProfilePhoto().subscribe({
      next: () => {
        if (this.profile) {
          this.profile.profilePhotoUrl = null;
        }

        this.selectedFile = null;
        this.previewUrl = null;

        this.clearBlobUrl();

        if (this.fileInputRef?.nativeElement) {
          this.fileInputRef.nativeElement.value = '';
        }

        this.removing = false;

        this.showToast(
          'Profile photo removed successfully.',
          'success'
        );
      },

      error: error => {
        this.removing = false;

        this.showToast(
          error?.error?.message ||
          'Failed to remove profile photo.',
          'error'
        );
      }
    });
  }

  changePassword(): void {
    if (
      !this.passwordForm.currentPassword ||
      !this.passwordForm.newPassword ||
      !this.passwordForm.confirmPassword
    ) {
      this.showToast(
        'Please fill all password fields.',
        'error'
      );

      return;
    }

    this.changingPassword = true;

    this.userService
      .changePassword(this.passwordForm)
      .subscribe({
        next: response => {
          this.changingPassword = false;

          this.passwordForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          };

          this.showChangePassword = false;

          this.showToast(
            response || 'Password changed successfully.',
            'success'
          );
        },

        error: error => {
          this.changingPassword = false;

          let message = 'Failed to change password.';

          if (error?.error) {
            if (typeof error.error === 'string') {
              try {
                const parsed = JSON.parse(error.error);
                message = parsed?.message || message;
              } catch {
                message = error.error || message;
              }
            } else if (typeof error.error === 'object') {
              message = error.error?.message || message;
            }
          }

          this.showToast(message, 'error');
        }
      });
  }

  /* =================================================
     Deactivation OTP timer
     ================================================= */

  private startDeactivationOtpTimer(
    durationInSeconds = 600
  ): void {
    this.clearDeactivationOtpTimer();

    this.deactivationOtpCountdown = durationInSeconds;
    this.canResendDeactivateOtp = false;

    this.updateDeactivationOtpDisplay();

    this.deactivationOtpTimer = setInterval(() => {
      if (this.deactivationOtpCountdown > 0) {
        this.deactivationOtpCountdown--;
        this.updateDeactivationOtpDisplay();
        return;
      }

      this.canResendDeactivateOtp = true;
      this.clearDeactivationOtpTimer();
    }, 1000);
  }

  private clearDeactivationOtpTimer(): void {
    if (!this.deactivationOtpTimer) {
      return;
    }

    clearInterval(this.deactivationOtpTimer);
    this.deactivationOtpTimer = null;
  }

  private resetDeactivationOtpState(): void {
    this.deactivateOtp = '';

    this.clearDeactivationOtpTimer();

    this.deactivationOtpCountdown = 0;
    this.deactivationOtpDisplayTime = '10:00';
    this.canResendDeactivateOtp = false;
  }

  private updateDeactivationOtpDisplay(): void {
    const minutes = Math.floor(
      this.deactivationOtpCountdown / 60
    );

    const seconds = this.deactivationOtpCountdown % 60;

    this.deactivationOtpDisplayTime =
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`;
  }

  /* =================================================
     Account deactivation
     ================================================= */

  openDeactivateFlow(): void {
    if (!this.canDeactivate) {
      this.showToast('Account is not active.', 'error');
      return;
    }

    this.resetDeactivationOtpState();

    this.deactivating = true;

    this.userService.requestAccountDeactivation().subscribe({
      next: response => {
        this.deactivating = false;

        this.startDeactivationOtpTimer(600);

        this.openModal('deactivateModal');

        this.showToast(
          response ||
          'OTP sent to your registered email.',
          'success'
        );
      },

      error: error => {
        this.deactivating = false;

        this.showToast(
          error?.error?.message ||
          'Failed to send deactivation OTP.',
          'error'
        );
      }
    });
  }

  resendDeactivateOtp(): void {
    if (!this.canResendDeactivateOtp) {
      return;
    }

    this.resendingDeactivateOtp = true;

    this.userService.requestAccountDeactivation().subscribe({
      next: response => {
        this.resendingDeactivateOtp = false;

        this.deactivateOtp = '';

        this.startDeactivationOtpTimer(600);

        this.showToast(
          response || 'OTP resent successfully.',
          'success'
        );
      },

      error: error => {
        this.resendingDeactivateOtp = false;

        this.showToast(
          error?.error?.message ||
          'Failed to resend OTP.',
          'error'
        );
      }
    });
  }

  confirmDeactivate(): void {
    const otp = this.deactivateOtp.trim();

    if (!/^\d{6}$/.test(otp)) {
      this.showToast(
        'Enter a valid 6-digit OTP.',
        'error'
      );

      return;
    }

    if (this.deactivationOtpCountdown === 0) {
      this.showToast(
        'OTP expired. Please request a new OTP.',
        'error'
      );

      return;
    }

    this.confirmingDeactivate = true;

    this.userService
      .confirmAccountDeactivation({ otp })
      .subscribe({
        next: response => {
          this.confirmingDeactivate = false;

          this.clearDeactivationOtpTimer();
          this.closeModal('deactivateModal');

          this.showToast(
            response || 'Account deactivated successfully.',
            'success'
          );

          setTimeout(() => {
            this.home.logout();
          }, 550);
        },

        error: error => {
          this.confirmingDeactivate = false;

          this.showToast(
            error?.error?.message ||
            'Failed to deactivate account.',
            'error'
          );
        }
      });
  }

  private openModal(id: string): void {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(
      element,
      {
        backdrop: 'static',
        keyboard: false
      }
    );

    modal.show();
  }

  private closeModal(id: string): void {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const modal = bootstrap.Modal.getInstance(element);

    modal?.hide();
  }
}