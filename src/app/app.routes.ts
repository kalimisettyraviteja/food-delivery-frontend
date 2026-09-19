import { Routes } from '@angular/router';
import { Admin } from './pages/admin/admin';
import { Restaurants } from './pages/admin/restaurants/restaurants';
import { MenuItems } from './pages/admin/menu-items/menu-items';
import { Users } from './pages/admin/users/users';
import { Home } from './pages/home/home';
import { HomeMain } from './pages/home/home-main/home-main';
import { Orders } from './pages/home/orders/orders';
import { Profile } from './pages/home/profile/profile';
import { SavedAddresses } from './pages/home/saved-addresses/saved-addresses';
import { OrderTracking } from './pages/home/order-tracking/order-tracking';
import { RestaurantDetail } from './pages/home/restaurant-detail/restaurant-detail';
import { Checkout } from './pages/home/checkout/checkout';
import { Coupons } from './pages/admin/coupons/coupons';
import { Test } from './test/test';
import { AdminOrders } from './pages/admin/orders/orders';
import { ManagerRequests } from './pages/admin/manager-requests/manager-requests';
import { MustChangePassword } from './pages/must-change-password/must-change-password';
import { RestaurantManager } from './pages/restaurant-manager/restaurant-manager';
import { ManagerDashboard } from './pages/restaurant-manager/manager-dashboard/manager-dashboard';
import { ManagerRestaurants } from './pages/restaurant-manager/manager-restaurants/manager-restaurants';
import { ManagerRestaurantForm } from './pages/restaurant-manager/manager-restaurant-form/manager-restaurant-form';
import { ManagerMenu } from './pages/restaurant-manager/manager-menu/manager-menu';
import { ManagerOrders } from './pages/restaurant-manager/manager-orders/manager-orders';
import { ManagerOrderDetail } from './pages/restaurant-manager/manager-order-detail/manager-order-detail';
import { ManagerReviews } from './pages/restaurant-manager/manager-reviews/manager-reviews';


import { roleGuard } from './guards/role-guard';
import { mustChangePasswordGuard } from './guards/must-change-password-guard';
import { passwordCompletedGuard } from './guards/password-completed-guard';
import { customerHomeGuard } from './guards/customer-home-guard';
import { ManagerCoupons } from './pages/restaurant-manager/manager-coupons/manager-coupons';



export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  { path: 'test', component: Test },

  { path: 'must-change-password', component: MustChangePassword, canActivate: [mustChangePasswordGuard] },

  {
    path: 'home',
    component: Home,
    canActivate: [customerHomeGuard],
    children: [
      { path: '', redirectTo: 'main', pathMatch: 'full' },
      { path: 'main', component: HomeMain },
      { path: 'restaurant/:id', component: RestaurantDetail, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'checkout', component: Checkout, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'order-tracking/:orderId', component: OrderTracking, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'orders', component: Orders, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'profile', component: Profile, canActivate: [roleGuard], data: { role: 'USER' } },
      { path: 'addresses', component: SavedAddresses, canActivate: [roleGuard], data: { role: 'USER' } }
    ]
  },


  {
    path: 'admin',
    component: Admin,
    canActivate: [roleGuard, passwordCompletedGuard],
    data: { role: 'ADMIN' },
    children: [
      { path: '', redirectTo: 'restaurants', pathMatch: 'full' },
      { path: 'manager-requests', component: ManagerRequests },
      { path: 'restaurants', component: Restaurants },
      { path: 'menu-items', component: MenuItems },
      { path: 'users', component: Users },
      { path: 'orders', component: AdminOrders },
      { path: 'coupons', component: Coupons }
    ]
  },

  {
    path: 'restaurant-manager',
    component: RestaurantManager,
    canActivate: [roleGuard, passwordCompletedGuard],
    data: { role: 'RESTAURANT_MANAGER' },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: ManagerDashboard },
      { path: 'restaurants', component: ManagerRestaurants },
      { path: 'restaurants/form', component: ManagerRestaurantForm },
      { path: 'restaurants/:restaurantId/menu', component: ManagerMenu },
      { path: 'orders', component: ManagerOrders },
      { path: 'orders/:orderId', component: ManagerOrderDetail },
      { path: 'reviews', component: ManagerReviews },
      { path: 'coupons', component: ManagerCoupons }
    ]
  },



  { path: '**', redirectTo: 'home' }
];