import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SalesReport {
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  salesByPaymentMethod: { method: string; amount: number }[];
  salesByCashier: { name: string; sales: number; amount: number }[];
  detailedSales: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private readonly API_URL = 'http://localhost:3021/api/reports';

  constructor(private http: HttpClient) {}

  getSalesReport(startDate: string, endDate: string): Observable<SalesReport> {
    return this.http.get<SalesReport>(`${this.API_URL}/sales?startDate=${startDate}&endDate=${endDate}`);
  }
}
