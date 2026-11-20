// tresorier.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { peutVoirTresorerie } from '../shared/auth.util';

export const tresorierGuard: CanActivateFn = () => {
  // Trésorier (gestion) ou superadmin (lecture seule)
  if (peutVoirTresorerie()) {
    return true;
  }

  const router = inject(Router);
  router.navigate(['/admin/dashboard']);
  return false;
};
