import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'CASHIER';
  active: boolean;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  role: 'ADMIN' | 'CASHIER';
}

export interface UpdateUserDto {
  email?: string;
  role?: 'ADMIN' | 'CASHIER';
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly API_URL = 'http://localhost:3021/api/users';

  private _users = signal<User[]>([]);
  private _isLoading = signal<boolean>(false);

  readonly users = this._users.asReadonly();
  readonly isLoading = this._users.asReadonly();

  constructor(private http: HttpClient) {}

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.API_URL);
  }

  findOne(id: string): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/${id}`);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.API_URL, dto);
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`${this.API_URL}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  resetPassword(id: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${id}/reset-password`, { password });
  }
}
