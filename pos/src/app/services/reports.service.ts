import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SalesByProductLine {
  productId: string;
  name: string;
  qty: number;
  total: number;
  cashTotal?: number;
  transferTotal?: number;
  cardTotal?: number;
}

export interface IpvLine {
  productId: string;
  name: string;
  inicio: number;
  entradas: number;
  salidas: number;
  vendido: number;
  final: number;
  precio: number;
  importe: number;
  importeTransferencia: number;
}

export interface IpvReport {
  cashSessionId: string;
  registerId: string;
  openedAt: string;
  closedAt?: string | null;
  workers: { id: string; email: string }[];
  lines: IpvLine[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private http: HttpClient) {}

  salesByProduct(params: { from: string; to: string; registerId?: string }) {
    const qs = new URLSearchParams();
    qs.set('from', params.from);
    qs.set('to', params.to);
    if (params.registerId) qs.set('registerId', params.registerId);
    return this.http.get<SalesByProductLine[]>(`/api/reports/sales-by-product?${qs.toString()}`);
  }

  ipv(cashSessionId: string) {
    return this.http.get<IpvReport>(`/api/reports/ipv?cashSessionId=${encodeURIComponent(cashSessionId)}`);
  }
}
