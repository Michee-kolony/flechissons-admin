// pas-tresorier.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isTresorier } from '../shared/auth.util';

/** Pages réservées aux administrateurs : le trésorier est renvoyé au tableau de bord */
export const pasTresorierGuard: CanActivateFn = () => {
  if (!isTresorier()) {
    return true;
  }
  return inject(Router).createUrlTree(['/admin/dashboard']);
};
