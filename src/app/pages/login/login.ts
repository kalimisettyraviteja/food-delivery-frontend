import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/services/user';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private userService = inject(UserService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = false;
  error = '';

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.userService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {

        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.role);
        localStorage.setItem('userName', res.name);
        localStorage.setItem('userId', String(res.id));

        this.loading = false;

        if (res.role === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Something went wrong, Please try after some time';
        this.loading = false;
      }
    });
  }
}