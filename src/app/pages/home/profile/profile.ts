import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserResponse,
  UserService
} from '../../../core/services/user';

declare const bootstrap: any;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {
  private userService = inject(UserService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('statusToast') statusToastRef!: ElementRef<HTMLDivElement>;

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

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    if (this.uploadedPhotoBlobUrl) {
      URL.revokeObjectURL(this.uploadedPhotoBlobUrl);
    }
  }

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
      if (!this.statusToastRef?.nativeElement) return;

      const toastEl = this.statusToastRef.nativeElement;
      const toast = bootstrap.Toast.getOrCreateInstance(toastEl, {
        delay: 3000,
        autohide: true
      });
      toast.show();
    });
  }

  openFilePicker(): void {
    this.fileInputRef?.nativeElement.click();
  }

  loadProfile(): void {
    this.loading = true;

    this.userService.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        this.form = {
          name: res.name,
          phone: res.phone
        };
        this.selectedFile = null;
        this.previewUrl = null;
        this.loadSavedPhoto();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.showToast(err?.error?.message || 'Failed to load profile.', 'error');
      }
    });
  }

  loadSavedPhoto(): void {
    if (!this.profile?.id || !this.profile?.profilePhotoUrl) {
      this.clearBlobUrl();
      return;
    }

    this.userService.getProfilePhotoBlob(this.profile.id).subscribe({
      next: (blob) => {
        this.clearBlobUrl();
        this.uploadedPhotoBlobUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.clearBlobUrl();
      }
    });
  }

  clearBlobUrl(): void {
    if (this.uploadedPhotoBlobUrl) {
      URL.revokeObjectURL(this.uploadedPhotoBlobUrl);
      this.uploadedPhotoBlobUrl = null;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!file) {
      this.selectedFile = null;
      this.previewUrl = null;
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedFile = null;
      this.previewUrl = null;
      this.showToast('Only JPG, PNG, and WEBP images are allowed.', 'error');
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
      next: (res) => {
        this.profile = res;
        this.form.name = res.name;
        this.form.phone = res.phone;
        this.saving = false;
        this.showToast('Profile updated successfully.', 'success');
      },
      error: (err) => {
        this.saving = false;
        this.showToast(err?.error?.message || 'Failed to update profile.', 'error');
      }
    });
  }

  uploadPhoto(): void {
    if (!this.selectedFile) {
      this.showToast('Please select an image first.', 'error');
      return;
    }

    this.uploading = true;

    this.userService.uploadProfilePhoto(this.selectedFile).subscribe({
      next: (res) => {
        this.profile = res;
        this.selectedFile = null;
        this.previewUrl = null;

        if (this.fileInputRef?.nativeElement) {
          this.fileInputRef.nativeElement.value = '';
        }

        this.uploading = false;
        this.loadSavedPhoto();
        this.showToast('Profile photo uploaded successfully.', 'success');
      },
      error: (err) => {
        this.uploading = false;
        this.showToast(err?.error?.message || 'Failed to upload profile photo.', 'error');
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
        this.showToast('Profile photo removed successfully.', 'success');
      },
      error: (err) => {
        this.removing = false;
        this.showToast(err?.error?.message || 'Failed to remove profile photo.', 'error');
      }
    });
  }

  // changePassword(): void {
  //   if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
  //     this.showToast('Please fill all password fields.', 'error');
  //     return;
  //   }

  //   if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
  //     this.showToast('New password and confirm password do not match.', 'error');
  //     return;
  //   }

  //   this.changingPassword = true;

  //   this.userService.changePassword(this.passwordForm).subscribe({
  //     next: (res) => {
  //       this.changingPassword = false;
  //       this.passwordForm = {
  //         currentPassword: '',
  //         newPassword: '',
  //         confirmPassword: ''
  //       };
  //       this.showToast(res || 'Password changed successfully.', 'success');
  //     },
  //     error: (err) => {
  //       this.changingPassword = false;
  //       this.showToast(err.error.message || 'Failed to change password.', 'error');
  //     }
  //   });
  // }

changePassword(): void {
  if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
    this.showToast('Please fill all password fields.', 'error');
    return;
  }

  // if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
  //   this.showToast('New password and confirm password do not match.', 'error');
  //   return;
  // }

  this.changingPassword = true;

  this.userService.changePassword(this.passwordForm).subscribe({
    next: (res) => {
      this.changingPassword = false;
      this.passwordForm = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      this.showChangePassword = false;
      this.showToast(res || 'Password changed successfully.', 'success');
    },
    error: (err) => {
      this.changingPassword = false;

      let message = 'Failed to change password.';

      if (err?.error) {
        if (typeof err.error === 'string') {
          try {
            const parsed = JSON.parse(err.error);
            message = parsed?.message || message;
          } catch {
            message = err.error || message;
          }
        } else if (typeof err.error === 'object') {
          message = err.error?.message || message;
        }
      }

      this.showToast(message, 'error');
    }
  });
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
}