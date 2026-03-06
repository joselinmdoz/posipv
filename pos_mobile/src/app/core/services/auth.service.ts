import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AuthUser, LoginResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly tokenKey = 'pos_mobile_access_token';
  private readonly userKey = 'pos_mobile_user';
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);

  readonly user$ = this.userSubject.asObservable();

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiConfig.baseUrl}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          localStorage.setItem(this.tokenKey, response.access_token);
          localStorage.setItem(this.userKey, JSON.stringify(response.user));
          this.userSubject.next(response.user);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.userSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private restoreSession(): void {
    const savedUser = localStorage.getItem(this.userKey);
    if (!savedUser || !this.getToken()) {
      return;
    }
    try {
      this.userSubject.next(JSON.parse(savedUser) as AuthUser);
    } catch {
      this.logout();
    }
  }
}
