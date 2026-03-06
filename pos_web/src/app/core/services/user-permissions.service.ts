import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PermissionCatalogItem {
  code: string;
  label: string;
  description: string;
  group: string;
}

export interface UserPermissionsUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'CASHIER' | string;
  active: boolean;
  permissions: string[];
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserPermissionsService {
  private readonly API_URL = '/api/user-permissions';

  constructor(private readonly http: HttpClient) {}

  getCatalog(): Observable<PermissionCatalogItem[]> {
    return this.http.get<PermissionCatalogItem[]>(`${this.API_URL}/catalog`);
  }

  listUsers(params?: { q?: string; active?: boolean; limit?: number }): Observable<UserPermissionsUser[]> {
    let query = new HttpParams();
    if (params?.q) query = query.set('q', params.q);
    if (params?.active !== undefined) query = query.set('active', String(params.active));
    if (params?.limit) query = query.set('limit', String(params.limit));
    return this.http.get<UserPermissionsUser[]>(`${this.API_URL}/users`, { params: query });
  }

  getUser(userId: string): Observable<UserPermissionsUser> {
    return this.http.get<UserPermissionsUser>(`${this.API_URL}/users/${userId}`);
  }

  updateUserPermissions(userId: string, permissions: string[]): Observable<UserPermissionsUser> {
    return this.http.put<UserPermissionsUser>(`${this.API_URL}/users/${userId}`, {
      permissions
    });
  }
}
