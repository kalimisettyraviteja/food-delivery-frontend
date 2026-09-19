import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const mustChangePasswordGuard: CanActivateFn = () => {
  const router = inject(Router);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const mustChangePassword =
    localStorage.getItem('mustChangePassword') === 'true';

  if (!token || !role) {
    return router.parseUrl('/home/main');
  }

  if (!mustChangePassword) {
    return router.parseUrl(getRoleRoute(role));
  }

  return true;
};

function getRoleRoute(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';

    case 'RESTAURANT_MANAGER':
      return '/restaurant-manager';

    case 'USER':
      return '/home/main';

    default:
      return '/home/main';
  }
}


// This means:

// Unauthenticated users cannot open the page.

// Users who already changed their password cannot open the page again.

// Users who still must change their password can access it.