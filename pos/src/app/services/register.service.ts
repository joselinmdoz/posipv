import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';

export interface Register {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

const REGISTER_KEY = 'pos_register_id';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private readonly _selectedId = signal<string | null>(localStorage.getItem(REGISTER_KEY));
  readonly selectedId = this._selectedId.asReadonly();

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Register[]>(`${API_BASE_URL}/api/registers`);
  }

  create(data: { name: string }) {
    return this.http.post<Register>(`${API_BASE_URL}/api/registers`, data);
  }

  update(id: string, data: { name: string }) {
    return this.http.patch<Register>(`${API_BASE_URL}/api/registers/${id}`, data);
  }

  select(id: string) {
    localStorage.setItem(REGISTER_KEY, id);
    this._selectedId.set(id);
  }

  clear() {
    localStorage.removeItem(REGISTER_KEY);
    this._selectedId.set(null);
  }

  delete(id: string) {
    return this.http.delete(`${API_BASE_URL}/api/registers/${id}`);
  }
}
