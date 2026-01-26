import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  cost?: string | null;
  unit?: string | null;
  image?: string | null;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Product[]>(`${API_BASE_URL}/api/products`);
  }

  create(input: { name: string; price: number; sku?: string; barcode?: string; cost?: number; unit?: string; image?: string }) {
    return this.http.post<Product>(`${API_BASE_URL}/api/products`, {
      name: input.name,
      sku: input.sku || undefined,
      barcode: input.barcode || undefined,
      price: input.price.toFixed(2),
      cost: input.cost ? input.cost.toFixed(2) : undefined,
      unit: input.unit || undefined,
      image: input.image || undefined,
    });
  }

  createWithFile(formData: FormData) {
    return this.http.post<Product>(`${API_BASE_URL}/api/products`, formData);
  }

  update(id: string, input: { name?: string; price?: number; sku?: string; barcode?: string; cost?: number; unit?: string; active?: boolean }) {
    return this.http.put<Product>(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}`, {
      name: input.name,
      sku: input.sku,
      barcode: input.barcode,
      price: input.price ? input.price.toFixed(2) : undefined,
      cost: input.cost ? input.cost.toFixed(2) : undefined,
      unit: input.unit,
      active: input.active,
    });
  }

  updateWithFile(id: string, formData: FormData) {
    return this.http.put<Product>(`/api/products/${encodeURIComponent(id)}`, formData);
  }
}
