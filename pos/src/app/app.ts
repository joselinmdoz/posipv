import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { RegisterService } from './services/register.service';
import { ToastComponent } from './ui/toast.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly register = inject(RegisterService);

  readonly user = toSignal(this.auth.user$, { initialValue: null });
  readonly isLoggedIn = computed(() => !!this.user());
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  logout() {
    this.auth.logout();
    location.href = '/login';
  }
}

