import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Register {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: Date;
}

export interface CreateRegisterDto {
  name: string;
  code?: string;
}

export interface UpdateRegisterDto {
  name: string;
  code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistersService {
  private readonly API_URL = '/api/registers';

  constructor(private http: HttpClient) {}

  list(): Observable<Register[]> {
    return this.http.get<Register[]>(this.API_URL);
  }

  create(dto: CreateRegisterDto): Observable<Register> {
    return this.http.post<Register>(this.API_URL, dto);
  }

  update(id: string, dto: UpdateRegisterDto): Observable<Register> {
    return this.http.patch<Register>(`${this.API_URL}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}
