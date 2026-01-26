import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Role } from './auth.service';

export interface UserRow {
  id: string;
  email: string;
  role: Role;
  createdAt?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<UserRow[]>('/api/users');
  }

  create(payload: { email: string; password: string; role: Role }) {
    return this.http.post<UserRow>('/api/users', payload);
  }

  update(id: string, payload: Partial<{ email: string; role: Role; active: boolean }>) {
    return this.http.put<UserRow>(`/api/users/${encodeURIComponent(id)}`, payload);
  }

  resetPassword(id: string, payload: { password: string }) {
    return this.http.post(`/api/users/${encodeURIComponent(id)}/reset-password`, payload);
  }
}
