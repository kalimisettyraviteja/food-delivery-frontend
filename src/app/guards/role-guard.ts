import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const role = localStorage.getItem('role');
  const requiredRole = route.data['role'];

  if (!role) {
    router.navigate(['/home/main']);
    return false;
  }

  if (requiredRole && role !== requiredRole) {
    router.navigate(['/home/main']);
    return false;
  }

  return true;
};