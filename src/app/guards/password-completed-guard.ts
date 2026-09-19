import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const passwordCompletedGuard: CanActivateFn = () => {
  const router = inject(Router);

  const mustChangePassword =
    localStorage.getItem('mustChangePassword') === 'true';

  if (mustChangePassword) {
    return router.parseUrl('/must-change-password');
  }

  return true;
};

// This prevents a manager or admin from directly opening their dashboard before changing the temporary password.