import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { RegisterService } from '../services/register.service';
import { CashService } from '../services/cash.service';
import { SessionService } from '../services/session.service';
import { catchError, map, of } from 'rxjs';

export const cashSessionGuard: CanActivateFn = () => {
  const reg = inject(RegisterService);
  const cash = inject(CashService);
  const session = inject(SessionService);
  const router = inject(Router);

  const registerId = reg.selectedId();
  if (!registerId) {
    router.navigateByUrl('/register');
    return false;
  }

  const cached = session.getCashSessionId(registerId);
  if (cached) return true;

  return cash.getOpen(registerId).pipe(
    map((open) => {
      if (open?.id) {
        session.setCashSessionId(registerId, open.id);
        return true;
      }
      return router.parseUrl('/register?needSession=1');
    }),
    catchError(() => of(router.parseUrl('/register?needSession=1'))),
  );
};
