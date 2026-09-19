import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const customerHomeGuard: CanActivateFn = () => {
  const router = inject(Router);

  const role = localStorage.getItem('role');
  const mustChangePassword =
    localStorage.getItem('mustChangePassword') === 'true';

  // Visitors without login can access the public home page.
  if (!role) {
    return true;
  }

  // Normal customers can access the home page.
  if (role === 'USER') {
    return true;
  }

  // Managers must complete their temporary-password change first.
  if (
    role === 'RESTAURANT_MANAGER' &&
    mustChangePassword
  ) {
    return router.parseUrl('/must-change-password');
  }

  // Managers with a completed password go to their dashboard.
  if (role === 'RESTAURANT_MANAGER') {
    return router.parseUrl('/restaurant-manager');
  }

  // Admins should remain in the admin section.
  if (role === 'ADMIN') {
    return router.parseUrl('/admin');
  }

  return router.parseUrl('/home/main');
};