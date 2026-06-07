import { Routes } from '@angular/router';
import { Login }            from './pages/login/login';
import { Register }         from './pages/register/register';
import { Admin }            from './pages/admin/admin';
import { Restaurants }      from './pages/admin/restaurants/restaurants';
import { MenuItems }        from './pages/admin/menu-items/menu-items';
import { Users }            from './pages/admin/users/users';
import { Home }             from './pages/home/home';
import { RestaurantDetail } from './pages/restaurant-detail/restaurant-detail';
import { roleGuard } from './guards/role-guard';
import { Checkout } from './pages/checkout/checkout';
import { Coupons } from './pages/admin/coupons/coupons';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Public
  { path: 'home',   component: Home },
  { path: 'login',  component: Login },
  { path: 'register', component: Register },
  
  { path: 'restaurant/:id', component: RestaurantDetail, canActivate: [roleGuard],
    data: { role: 'USER' } },
  { path: 'checkout', component: Checkout, canActivate: [roleGuard], data: { role: 'USER' } },


  // Admin only
  {
    path: 'admin',
    component: Admin,
    canActivate: [roleGuard],
    data: { role: 'ADMIN' },
    children: [
      { path: '', redirectTo: 'restaurants', pathMatch: 'full' },
      { path: 'restaurants', component: Restaurants },
      { path: 'menu-items',  component: MenuItems },
      { path: 'users',       component: Users },
      { path: 'coupons', component: Coupons }

    ]
  },
  { path: '**', redirectTo: 'home' }
];