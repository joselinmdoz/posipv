import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, UserRow } from '../../services/users.service';
import { Role } from '../../services/auth.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent {
  private readonly api = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly users = signal<UserRow[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly showNew = signal(false);
  email = '';
  password = '';
  role: Role = 'CASHIER';

  constructor() {
    this.reload();
  }

  toggleNew(){ this.showNew.set(!this.showNew()); }

  reload() {
    this.busy.set(true);
    this.error.set(null);
    this.api.list().pipe(
      catchError(() => {
        this.error.set('users_failed');
        return of([]);
      }),
    ).subscribe((d) => {
      this.users.set(d);
      this.busy.set(false);
    });
  }

  create() {
    if (!this.email || !this.password) return;
    this.busy.set(true);
    this.api.create({ email: this.email, password: this.password, role: this.role }).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo crear', message: 'Verifica /api/users' });
        return of(null);
      }),
    ).subscribe((u) => {
      if (u) {
        this.toast.push({ kind: 'success', title: 'Usuario creado', message: u.email });
        this.users.update((arr) => [u, ...arr]);
        this.email=''; this.password=''; this.role='CASHIER';
        this.showNew.set(false);
      }
      this.busy.set(false);
    });
  }
}
