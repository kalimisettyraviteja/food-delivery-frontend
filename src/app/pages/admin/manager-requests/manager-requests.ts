import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UserService,
  ManagerRegistrationResponse
} from '../../../core/services/user';

type RequestStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

@Component({
  selector: 'app-manager-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-requests.html',
  styleUrl: './manager-requests.css'
})
export class ManagerRequests implements OnInit {
  private userService = inject(UserService);

  requests: ManagerRegistrationResponse[] = [];
  loading = false;
  actionLoadingId: number | null = null;

  selectedStatus: RequestStatusFilter = 'ALL';
  selectedRequest: ManagerRegistrationResponse | null = null;

  rejectReason = '';
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const status = this.selectedStatus === 'ALL' ? undefined : this.selectedStatus;

    this.userService.getManagerRegistrationRequests(status).subscribe({
      next: (res) => {
        this.requests = res ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load manager requests.';
        this.loading = false;
      }
    });
  }

  onStatusChange(): void {
    this.loadRequests();
  }

  approve(request: ManagerRegistrationResponse): void {
    if (!request?.id) return;

    this.actionLoadingId = request.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.approveManagerRegistration(request.id).subscribe({
      next: (updated) => {
        this.successMessage = `Approved request for ${updated.name}.`;
        this.updateRequestInList(updated);
        this.actionLoadingId = null;

        if (this.selectedRequest?.id === updated.id) {
          this.selectedRequest = updated;
        }
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to approve manager request.';
        this.actionLoadingId = null;
      }
    });
  }

  openRejectModal(request: ManagerRegistrationResponse): void {
    this.selectedRequest = request;
    this.rejectReason = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  rejectSelected(): void {
    if (!this.selectedRequest?.id) return;

    this.actionLoadingId = this.selectedRequest.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.rejectManagerRegistration(this.selectedRequest.id, {
      rejectionReason: this.rejectReason?.trim() || null
    }).subscribe({
      next: (updated) => {
        this.successMessage = `Rejected request for ${updated.name}.`;
        this.updateRequestInList(updated);
        this.selectedRequest = null;
        this.rejectReason = '';
        this.actionLoadingId = null;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to reject manager request.';
        this.actionLoadingId = null;
      }
    });
  }

  closeRejectModal(): void {
    this.selectedRequest = null;
    this.rejectReason = '';
  }

  trackByRequestId(_: number, item: ManagerRegistrationResponse): number {
    return item.id;
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'APPROVED':
        return 'status-badge approved';
      case 'REJECTED':
        return 'status-badge rejected';
      default:
        return 'status-badge pending';
    }
  }

  private updateRequestInList(updated: ManagerRegistrationResponse): void {
    this.requests = this.requests.map((item) =>
      item.id === updated.id ? updated : item
    );

    if (this.selectedStatus !== 'ALL' && updated.status !== this.selectedStatus) {
      this.requests = this.requests.filter((item) => item.id !== updated.id);
    }
  }
}