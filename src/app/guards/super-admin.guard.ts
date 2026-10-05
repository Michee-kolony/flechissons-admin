// super-admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isSuperAdmin } from '../shared/auth.util';

export const superAdminGuard: CanActivateFn = () => {
  if (isSuperAdmin()) {
    return true;
  }

  const router = inject(Router);
  router.navigate(['/admin/dashboard']);
  return false;
};
