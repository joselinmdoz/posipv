import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, AuthUser } from '../../services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'admin@pos.local';
  password = 'Admin123!';

  loading = signal(false);
  error = signal('');

  login() {
    this.error.set('');
    this.loading.set(true);

    this.auth
      .login(this.email, this.password)
      .subscribe({
        next: (res) => {
          this.auth.setSession(res.access_token, res.user);
          setTimeout(() => this.router.navigateByUrl('/dashboard'), 0);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          const msg = e?.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo iniciar sesión.');
        },
      });
  }
}

