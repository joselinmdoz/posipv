import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

export interface MeasurementUnit {
  id: string;
  name: string;
  symbol: string;
  active: boolean;
  createdAt: Date;
  typeId?: string;
  type?: MeasurementUnitType;
}

export interface MeasurementUnitType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private readonly API_URL = '/api';

  constructor(private http: HttpClient) {}

  // Product Types
  getProductTypes(): Observable<ProductType[]> {
    return this.http.get<ProductType[]>(`${this.API_URL}/product-types`);
  }

  createProductType(data: Partial<ProductType>): Observable<ProductType> {
    return this.http.post<ProductType>(`${this.API_URL}/product-types`, data);
  }

  updateProductType(id: string, data: Partial<ProductType>): Observable<ProductType> {
    return this.http.put<ProductType>(`${this.API_URL}/product-types/${id}`, data);
  }

  deleteProductType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/product-types/${id}`);
  }

  // Product Categories
  getProductCategories(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(`${this.API_URL}/product-categories`);
  }

  createProductCategory(data: Partial<ProductCategory>): Observable<ProductCategory> {
    return this.http.post<ProductCategory>(`${this.API_URL}/product-categories`, data);
  }

  updateProductCategory(id: string, data: Partial<ProductCategory>): Observable<ProductCategory> {
    return this.http.put<ProductCategory>(`${this.API_URL}/product-categories/${id}`, data);
  }

  deleteProductCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/product-categories/${id}`);
  }

  // Measurement Units
  getMeasurementUnits(): Observable<MeasurementUnit[]> {
    return this.http.get<MeasurementUnit[]>(`${this.API_URL}/measurement-units`);
  }

  createMeasurementUnit(data: Partial<MeasurementUnit>): Observable<MeasurementUnit> {
    return this.http.post<MeasurementUnit>(`${this.API_URL}/measurement-units`, data);
  }

  updateMeasurementUnit(id: string, data: Partial<MeasurementUnit>): Observable<MeasurementUnit> {
    return this.http.put<MeasurementUnit>(`${this.API_URL}/measurement-units/${id}`, data);
  }

  deleteMeasurementUnit(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/measurement-units/${id}`);
  }

  // Measurement Unit Types
  getMeasurementUnitTypes(): Observable<MeasurementUnitType[]> {
    return this.http.get<MeasurementUnitType[]>(`${this.API_URL}/measurement-unit-types`);
  }

  createMeasurementUnitType(data: Partial<MeasurementUnitType>): Observable<MeasurementUnitType> {
    return this.http.post<MeasurementUnitType>(`${this.API_URL}/measurement-unit-types`, data);
  }

  updateMeasurementUnitType(id: string, data: Partial<MeasurementUnitType>): Observable<MeasurementUnitType> {
    return this.http.put<MeasurementUnitType>(`${this.API_URL}/measurement-unit-types/${id}`, data);
  }

  deleteMeasurementUnitType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/measurement-unit-types/${id}`);
  }
}
