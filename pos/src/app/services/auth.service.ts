import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ToastService } from '../ui/toast.service';
import { API_BASE_URL } from '../api.config';

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export type AuthUser = User;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  private idleListeners: Array<() => void> = [];
  private idleTimer: any = null;
  private warnTimer: any = null;
  private warned = false;

  /** 2 minutes of inactivity */
  private readonly IDLE_MS = 2 * 60 * 1000;
  /** Warn 30s before logout */
  private readonly WARN_BEFORE_MS = 30 * 1000;

  constructor() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        this.userSubject.next(JSON.parse(userJson));
        this.startIdleWatch();
      } catch {
        // ignore
      }
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  token(): string | null {
    return localStorage.getItem('token');
  }

  user(): User | null {
    return this.userSubject.value;
  }

  login(email: string, password: string) {
    return this.http.post<{ access_token: string; user: User }>(`${API_BASE_URL}/api/auth/login`, { email, password });
  }

  setSession(access_token: string, user: User) {
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    this.userSubject.next(user);
    this.startIdleWatch();
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.userSubject.next(null);
    this.stopIdleWatch();
    this.router.navigateByUrl('/login');
  }

  private startIdleWatch() {
    this.stopIdleWatch(); // reset
    this.warned = false;

    const reset = () => this.scheduleIdleTimers();
    const add = (event: string) => {
      const handler = () => reset();
      window.addEventListener(event, handler, { passive: true });
      this.idleListeners.push(() => window.removeEventListener(event, handler));
    };

    // Mouse + keyboard + touch = activity
    add('mousemove');
    add('mousedown');
    add('keydown');
    add('touchstart');
    add('scroll');

    // Initial schedule
    this.scheduleIdleTimers();
  }

  private stopIdleWatch() {
    this.idleListeners.forEach((fn) => fn());
    this.idleListeners = [];
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warnTimer) clearTimeout(this.warnTimer);
    this.idleTimer = null;
    this.warnTimer = null;
    this.warned = false;
  }

  private scheduleIdleTimers() {
    if (!this.isLoggedIn()) return;

    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warnTimer) clearTimeout(this.warnTimer);

    this.warned = false;

    this.warnTimer = setTimeout(() => {
      if (!this.isLoggedIn()) return;
      this.warned = true;
      this.toast.push({
        kind: 'warning',
        title: 'Inactividad',
        message: 'En 30 segundos se cerrará la sesión. Mueve el mouse o presiona una tecla para continuar.',
        timeoutMs: 9000,
      });
    }, Math.max(0, this.IDLE_MS - this.WARN_BEFORE_MS));

    this.idleTimer = setTimeout(() => {
      if (!this.isLoggedIn()) return;
      this.toast.push({ kind: 'info', title: 'Sesión cerrada', message: 'Se cerró por inactividad.', timeoutMs: 5000 });
      this.logout();
    }, this.IDLE_MS);
  }
}
