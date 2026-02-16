import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of } from 'rxjs';

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3021/api';
  
  // Signals para estado reactivo
  private _currentUser = signal<LoginResponse['user'] | null>(null);
  private _isAuthenticated = signal<boolean>(false);
  private _isLoading = signal<boolean>(false);
  
  // Computed values
  readonly currentUser = computed(() => this._currentUser());
  readonly isAuthenticated = computed(() => this._isAuthenticated());
  readonly isLoading = computed(() => this._isLoading());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.checkAuthStatus();
  }

  private checkAuthStatus(): void {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
      } catch {
        this.logout();
      }
    }
  }

  login(email: string, password: string) {
    this._isLoading.set(true);
    
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/login`, { email, password }).pipe(
      tap(response => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        this._currentUser.set(response.user);
        this._isAuthenticated.set(true);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        throw error;
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getUser(): LoginResponse['user'] | null {
    return this._currentUser();
  }
}
