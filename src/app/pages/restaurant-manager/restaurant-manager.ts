import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet
} from '@angular/router';
import { filter } from 'rxjs';
import { UserService } from '../../core/services/user';

@Component({
  selector: 'app-restaurant-manager',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './restaurant-manager.html',
  styleUrl: './restaurant-manager.css'
})
export class RestaurantManager implements OnInit {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  userName = '';
  loadingUser = true;

  ngOnInit(): void {
    this.refreshUser();

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe(() => {
        this.refreshUser();
      });
  }

  private refreshUser(): void {
    this.loadingUser = true;

    setTimeout(() => {
      this.userName = this.userService.getUserName() || '';
      this.loadingUser = false;
    }, 180);
  }

  goToProfile(): void {
    this.router.navigate(['/restaurant-manager/profile']);
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/home/main']);
  }
}