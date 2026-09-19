import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

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

export type EmailNextStep =
  | 'LOGIN'
  | 'REGISTER'
  | 'PENDING_VERIFICATION'
  | 'MANAGER_REQUEST_PENDING'
  | 'MANAGER_REQUEST_REJECTED'
  | 'REACTIVATION';

export interface EmailStatusResponse {
  message: string;
  nextStep: EmailNextStep;
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
  currentPassword?: string | null;
  newPassword: string;
  confirmPassword: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  accountStatus?: string;
  mustChangePassword?: boolean;
  profilePhotoUrl?: string | null;
}

export interface LoginResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  token: string;
  mustChangePassword?: boolean;
}

export interface DeactivateConfirmRequest {
  otp: string;
}

export interface ReactivateRequest {
  email: string;
}

export interface ReactivateConfirmRequest {
  email: string;
  otp: string;
}

export interface AddressRequest {
  label: 'HOME' | 'WORK' | 'OTHER';
  customLabel?: string | null;
  receiverName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface AddressResponse {
  id: number;
  label: 'HOME' | 'WORK' | 'OTHER';
  customLabel?: string | null;
  receiverName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface DeliveryEstimate {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
}

export interface ManagerRegistrationSubmitRequest {
  name: string;
  email: string;
  phone: string;
}

export interface ManagerRegistrationResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  requestedRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdAt?: string;
  reviewedAt?: string | null;
}

export interface ManagerRegistrationDecisionRequest {
  rejectionReason?: string | null;
}

interface OsrmRouteResponse {
  code: string;
  routes: {
    distance: number;
    duration: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = 'http://localhost:8080/api/users';

  private _isLoggedIn$ = new BehaviorSubject<boolean>(this.isLoggedIn());
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  checkEmailStatus(req: EmailCheckRequest): Observable<EmailStatusResponse> {
    return this.http.post<EmailStatusResponse>(`${this.base}/auth/email-status`, req);
  }

  register(req: RegisterRequest): Observable<string> {
    return this.http.post(`${this.base}/register`, req, { responseType: 'text' });
  }

  submitManagerRequest(req: ManagerRegistrationSubmitRequest): Observable<string> {
    return this.http.post(`${this.base}/manager/register-request`, req, {
      responseType: 'text'
    });
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

  //   requestAccountDeactivation(): Observable<string> {
  //   return this.http.post(`${this.base}/profile/deactivate/request`, {}, { responseType: 'text' });
  // }

  // confirmAccountDeactivation(req: DeactivateConfirmRequest): Observable<string> {
  //   return this.http.post(`${this.base}/profile/deactivate/confirm`, req, { responseType: 'text' });
  // }

  requestAccountDeactivation(): Observable<string> {
    return this.http.post(`${this.base}/profile/deactivate/request`, {}, { responseType: 'text' });
  }

  confirmAccountDeactivation(req: DeactivateConfirmRequest): Observable<string> {
    return this.http.post(`${this.base}/profile/deactivate/confirm`, req, { responseType: 'text' });
  }

  requestAccountReactivation(email: string): Observable<string> {
    const body: ReactivateRequest = { email };
    return this.http.post(`${this.base}/reactivate/request`, body, { responseType: 'text' });
  }

  confirmAccountReactivation(req: ReactivateConfirmRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/reactivate/confirm`, req);
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(this.base);
  }

  getApprovedManagers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(`${this.base}/managers`);
  }

  getManagerRegistrationRequests(
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Observable<ManagerRegistrationResponse[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ManagerRegistrationResponse[]>(`${this.base}/manager-requests`, { params });
  }

  approveManagerRegistration(id: number): Observable<ManagerRegistrationResponse> {
    return this.http.patch<ManagerRegistrationResponse>(
      `${this.base}/manager-requests/${id}/approve`,
      {}
    );
  }

  rejectManagerRegistration(
    id: number,
    req?: ManagerRegistrationDecisionRequest
  ): Observable<ManagerRegistrationResponse> {
    return this.http.patch<ManagerRegistrationResponse>(
      `${this.base}/manager-requests/${id}/reject`,
      req ?? {}
    );
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

  getSavedAddresses(): Observable<AddressResponse[]> {
    return this.http.get<AddressResponse[]>(`${this.base}/addresses`);
  }

  getDefaultAddress(): Observable<AddressResponse> {
    return this.http.get<AddressResponse>(`${this.base}/addresses/default`);
  }

  addAddress(req: AddressRequest): Observable<AddressResponse> {
    return this.http.post<AddressResponse>(`${this.base}/addresses`, req);
  }

  updateAddress(addressId: number, req: AddressRequest): Observable<AddressResponse> {
    return this.http.put<AddressResponse>(`${this.base}/addresses/${addressId}`, req);
  }

  setDefaultAddress(addressId: number): Observable<AddressResponse> {
    return this.http.patch<AddressResponse>(`${this.base}/addresses/${addressId}/default`, {});
  }

  deleteAddress(addressId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/addresses/${addressId}`);
  }

  getDeliveryEstimate(
    restaurantLat: number,
    restaurantLng: number,
    userLat: number,
    userLng: number
  ): Observable<DeliveryEstimate> {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${restaurantLng},${restaurantLat};${userLng},${userLat}?overview=false`;

    return this.http.get<OsrmRouteResponse>(url).pipe(
      map((res) => {
        const route = res?.routes?.[0];

        if (!route) {
          throw new Error('No route found');
        }

        return {
          distanceMeters: Math.round(route.distance),
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          durationSeconds: Math.round(route.duration),
          durationMinutes: Math.max(1, Math.round(route.duration / 60))
        };
      })
    );
  }

  logout(): void {
    localStorage.clear();
    this.emitAuthChange(false);
  }

  setSession(res: LoginResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('role', res.role);
    localStorage.setItem('userName', res.name);
    localStorage.setItem('userId', String(res.id));
    localStorage.setItem('email', res.email);
    localStorage.setItem('mustChangePassword', String(res.mustChangePassword === true));

    this.emitAuthChange(true);
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

  getUserId(): number | null {
    const userId = localStorage.getItem('userId');
    return userId ? Number(userId) : null;
  }

  getMustChangePassword(): boolean {
    return localStorage.getItem('mustChangePassword') === 'true';
  }

  setMustChangePassword(value: boolean): void {
    localStorage.setItem('mustChangePassword', String(value));
  }

  clearMustChangePassword(): void {
    localStorage.setItem('mustChangePassword', 'false');
  }

  setSelectedAddressId(addressId: number): void {
    localStorage.setItem('selectedAddressId', String(addressId));
  }

  getSelectedAddressId(): number | null {
    const id = localStorage.getItem('selectedAddressId');
    return id ? Number(id) : null;
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token') && !!localStorage.getItem('role');
  }

  emitAuthChange(state: boolean): void {
    this._isLoggedIn$.next(state);
  }
}