import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EmployeeUserRef {
  id: string;
  email: string;
  role: 'ADMIN' | 'CASHIER' | string;
  active: boolean;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  image: string | null;
  hireDate: string | null;
  salary: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  user: EmployeeUserRef | null;
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  identification?: string;
  phone?: string;
  email?: string;
  position?: string;
  image?: string;
  hireDate?: string;
  salary?: string;
  notes?: string;
  active?: boolean;
  userId?: string;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

@Injectable({
  providedIn: 'root'
})
export class EmployeesService {
  private readonly API_URL = '/api/employees';

  constructor(private readonly http: HttpClient) {}

  list(params?: { q?: string; active?: boolean; limit?: number }): Observable<Employee[]> {
    let query = new HttpParams();
    if (params?.q) query = query.set('q', params.q);
    if (params?.active !== undefined) query = query.set('active', String(params.active));
    if (params?.limit) query = query.set('limit', String(params.limit));
    return this.http.get<Employee[]>(this.API_URL, { params: query });
  }

  findOne(employeeId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.API_URL}/${employeeId}`);
  }

  create(payload: CreateEmployeeDto): Observable<Employee> {
    return this.http.post<Employee>(this.API_URL, payload);
  }

  createWithFormData(formData: FormData): Observable<Employee> {
    return this.http.post<Employee>(this.API_URL, formData);
  }

  update(employeeId: string, payload: UpdateEmployeeDto): Observable<Employee> {
    return this.http.put<Employee>(`${this.API_URL}/${employeeId}`, payload);
  }

  updateWithFormData(employeeId: string, formData: FormData): Observable<Employee> {
    return this.http.put<Employee>(`${this.API_URL}/${employeeId}`, formData);
  }

  listAssignableUsers(excludeEmployeeId?: string): Observable<EmployeeUserRef[]> {
    const params = excludeEmployeeId ? new HttpParams().set('excludeEmployeeId', excludeEmployeeId) : undefined;
    return this.http.get<EmployeeUserRef[]>(`${this.API_URL}/users/available`, { params });
  }
}
