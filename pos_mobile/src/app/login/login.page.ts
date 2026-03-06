import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  errorMessage = '';
  isSubmitting = false;

  readonly form = this.fb.nonNullable.group({
    email: ['admin@pos.local', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    const { email, password } = this.form.getRawValue();

    this.authService.login(email.trim(), password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage = this.resolveErrorMessage(error);
      }
    });
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se pudo conectar al servidor. Verifica USB/adb reverse y API de desarrollo.';
    }

    const apiMessage = error.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage;
    }
    if (Array.isArray(apiMessage) && apiMessage.length > 0) {
      return String(apiMessage[0]);
    }

    if (error.status === 401) {
      return 'Credenciales invalidas.';
    }

    return 'No se pudo iniciar sesion.';
  }
}
