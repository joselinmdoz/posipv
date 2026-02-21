import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  unit?: string;
  image?: string;
  active: boolean;
  createdAt: Date;
}

export interface CreateProductDto {
  name: string;
  sku?: string;
  barcode?: string;
  price: string;
  cost?: string;
  unit?: string;
  image?: string;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  barcode?: string;
  price?: string;
  cost?: string;
  unit?: string;
  image?: string;
  active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly API_URL = 'http://localhost:3021/api/products';

  constructor(private http: HttpClient) {}

  list(): Observable<Product[]> {
    return this.http.get<Product[]>(this.API_URL);
  }

  findOne(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/${id}`);
  }

  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.API_URL, dto);
  }

  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.put<Product>(`${this.API_URL}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  // Upload image with form data
  uploadImage(file: File): Observable<{ path: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ path: string }>(`${this.API_URL}/upload`, formData);
  }
}
