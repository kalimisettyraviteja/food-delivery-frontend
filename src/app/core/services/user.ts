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

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
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

   logout(): void {
    // localStorage.removeItem('token');
    // localStorage.removeItem('role');
    // localStorage.removeItem('userName');
    // localStorage.removeItem('userId');
    localStorage.clear();
  }

   getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
}