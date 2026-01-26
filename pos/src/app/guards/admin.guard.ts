import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.user();
  if (!user) {
    router.navigateByUrl('/login');
    return false;
  }
  if (user.role === 'ADMIN') return true;

  router.navigateByUrl('/dashboard');
  return false;
};
