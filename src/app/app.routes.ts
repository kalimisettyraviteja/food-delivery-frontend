import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Admin } from './pages/admin/admin';
import { Restaurants } from './pages/admin/restaurants/restaurants';
import { MenuItems } from './pages/admin/menu-items/menu-items';
import { Users } from './pages/admin/users/users';
import { Home } from './pages/home/home';
import { HomeMain } from './pages/home/home-main/home-main';
import { Orders } from './pages/home/orders/orders';
import { Profile } from './pages/home/profile/profile';
import { SavedAddresses } from './pages/home/saved-addresses/saved-addresses';
import { RestaurantDetail } from './pages/home/restaurant-detail/restaurant-detail';
import { roleGuard } from './guards/role-guard';
import { Checkout } from './pages/home/checkout/checkout';
import { Coupons } from './pages/admin/coupons/coupons';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'home',
    component: Home,
    children: [
      { path: '', redirectTo: 'main', pathMatch: 'full' },
      { path: 'main', component: HomeMain },
      { path: 'restaurant/:id', component: RestaurantDetail, canActivate: [roleGuard], data: { role: 'USER' }},
      { path: 'checkout', component: Checkout, canActivate: [roleGuard], data: { role: 'USER' } },

      { path: 'orders', component: Orders, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'profile', component: Profile, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'addresses', component: SavedAddresses, canActivate: [roleGuard], data: { role: 'USER' } }
    ]
  },

  //  { path: 'login', component: Login },




  {
    path: 'admin',
    component: Admin,
    canActivate: [roleGuard],
    data: { role: 'ADMIN' },
    children: [
      { path: '', redirectTo: 'restaurants', pathMatch: 'full' },
      { path: 'restaurants', component: Restaurants },
      { path: 'menu-items', component: MenuItems },
      { path: 'users', component: Users },
      { path: 'coupons', component: Coupons }
    ]
  },

  { path: '**', redirectTo: 'home' }
];