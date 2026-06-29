import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {
  private router = inject(Router);

  userName = localStorage.getItem('userName') || 'Admin';
  isSidebarOpen = false;

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  handleNavClick(): void {
    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 768) {
      this.closeSidebar();
    }
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}