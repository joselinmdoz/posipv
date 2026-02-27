import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SystemCurrencyCode } from './settings.service';

export interface ProductType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface MeasurementUnit {
  id: string;
  name: string;
  symbol: string;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  codigo?: string;
  barcode?: string;
  price: number;
  qtyAvailable?: number;
  cost?: number;
  currency: SystemCurrencyCode;
  image?: string;
  active: boolean;
  createdAt: Date;
  productType?: ProductType;
  productTypeId?: string;
  productCategory?: ProductCategory;
  productCategoryId?: string;
  measurementUnit?: MeasurementUnit;
  measurementUnitId?: string;
}

export interface CreateProductDto {
  name: string;
  codigo?: string;
  barcode?: string;
  price: string;
  cost?: string;
  currency?: SystemCurrencyCode;
  image?: string;
  productTypeId?: string;
  productCategoryId?: string;
  measurementUnitId?: string;
}

export interface UpdateProductDto {
  name?: string;
  codigo?: string;
  barcode?: string;
  price?: string;
  cost?: string;
  currency?: SystemCurrencyCode;
  image?: string;
  active?: boolean;
  productTypeId?: string;
  productCategoryId?: string;
  measurementUnitId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly API_URL = '/api/products';

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

  // Create product with form data (including image)
  createWithFormData(formData: FormData): Observable<Product> {
    return this.http.post<Product>(this.API_URL, formData);
  }

  // Update product with form data (including image)
  updateWithFormData(id: string, formData: FormData): Observable<Product> {
    return this.http.put<Product>(`${this.API_URL}/${id}`, formData);
  }
}
