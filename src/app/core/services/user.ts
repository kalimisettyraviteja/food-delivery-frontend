import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface LoginRequest {
  email: string;
  password: string;
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
  private base = 'http://localhost:8080/api/users';

  register(req: RegisterRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.base}/register`, req);
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login`, req);
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

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  getUserName(): string {
    return localStorage.getItem('name') || '';
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}