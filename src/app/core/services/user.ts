import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface EmailCheckRequest {
  email: string;
}

export interface EmailStatusResponse {
  message: string;
  nextStep: 'LOGIN' | 'REGISTER' | 'PENDING_VERIFICATION';
  email: string;
  name?: string;
}

export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  name: string;
  phone: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  profilePhotoUrl?: string | null;
}

export interface LoginResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = 'https://api-gateway-ftbf.onrender.com/api/users';

  checkEmailStatus(req: EmailCheckRequest): Observable<EmailStatusResponse> {
    return this.http.post<EmailStatusResponse>(`${this.base}/auth/email-status`, req);
  }

  register(req: RegisterRequest): Observable<string> {
    return this.http.post(`${this.base}/register`, req, { responseType: 'text' });
  }

  verifyEmail(req: VerifyEmailRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/verify-email`, req);
  }

  resendVerificationOtp(data: { email: string }): Observable<string> {
    return this.http.post(`${this.base}/resend-verification`, data, { responseType: 'text' });
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, req);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<string> {
    return this.http.post(`${this.base}/forgot-password`, data, { responseType: 'text' });
  }

  verifyResetOtp(data: { email: string; otp: string }): Observable<string> {
    return this.http.post(`${this.base}/verify-reset-otp`, data, { responseType: 'text' });
  }

  resetPassword(data: ResetPasswordRequest): Observable<string> {
    return this.http.post(`${this.base}/reset-password`, data, { responseType: 'text' });
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(this.base);
  }

  getProfile(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.base}/profile`);
  }

  updateProfile(req: UpdateProfileRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.base}/profile`, req);
  }

  uploadProfilePhoto(file: File): Observable<UserResponse> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.put<UserResponse>(`${this.base}/profile/photo`, formData);
  }

  removeProfilePhoto(): Observable<void> {
    return this.http.delete<void>(`${this.base}/profile/photo`);
  }

  changePassword(req: ChangePasswordRequest): Observable<string> {
    return this.http.put(`${this.base}/profile/change-password`, req, {
      responseType: 'text'
    });
  }

  getProfilePhotoUrl(photoPath?: string | null): string {
    if (!photoPath) return '';
    if (photoPath.startsWith('http')) return photoPath;
    return `http://localhost:8080${photoPath}`;
  }

  getProfilePhotoBlob(userId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${userId}/profile-photo`, {
      responseType: 'blob'
    });
  }

  logout(): void {
    localStorage.clear();
  }

  setSession(res: LoginResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('role', res.role);
    localStorage.setItem('userName', res.name);
    localStorage.setItem('userId', String(res.id));
    localStorage.setItem('email', res.email);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  getUserName(): string {
    return localStorage.getItem('userName') || '';
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }


  // Inside your UserService class — add this:
  private _isLoggedIn$ = new BehaviorSubject<boolean>(this.isLoggedIn());
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  // Call this after login/logout to notify all subscribers
  emitAuthChange(state: boolean): void {
    this._isLoggedIn$.next(state);
  }
}