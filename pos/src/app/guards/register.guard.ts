import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { RegisterService } from '../services/register.service';

export const registerGuard: CanActivateFn = () => {
  const reg = inject(RegisterService);
  const router = inject(Router);
  if (reg.selectedId()) return true;
  router.navigateByUrl('/register');
  return false;
};
