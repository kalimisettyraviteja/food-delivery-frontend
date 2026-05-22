import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, UserResponse } from '../../../core/services/user';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private svc = inject(UserService);
  users   = signal<UserResponse[]>([]);
  loading = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getAllUsers().subscribe({
      next:  (data) => { this.users.set(data); this.loading.set(false); },
      error: ()     => this.loading.set(false)
    });
  }
}