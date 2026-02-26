import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegisterSettings {
  id: string;
  registerId: string;
  defaultOpeningFloat: number;
  currency: string;
  warehouseId?: string;
  paymentMethods: PaymentMethodSetting[];
  denominations: Denomination[];
}

export interface PaymentMethodSetting {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
}

export interface Denomination {
  id: string;
  value: number;
  enabled: boolean;
}

export type SystemCurrencyCode = 'CUP' | 'USD';

export interface SystemSettings {
  id: string;
  defaultCurrency: SystemCurrencyCode;
  enabledCurrencies: SystemCurrencyCode[];
  exchangeRateUsdToCup: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRateRecord {
  id: string;
  baseCurrency: SystemCurrencyCode;
  quoteCurrency: SystemCurrencyCode;
  rate: number;
  source: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly API_URL = 'http://localhost:3021/api/settings';

  constructor(private http: HttpClient) {}

  getSystemSettings(): Observable<SystemSettings> {
    return this.http.get<SystemSettings>(`${this.API_URL}/system`);
  }

  saveSystemSettings(data: {
    defaultCurrency?: SystemCurrencyCode;
    enabledCurrencies?: SystemCurrencyCode[];
    exchangeRateUsdToCup?: number;
  }): Observable<SystemSettings> {
    return this.http.put<SystemSettings>(`${this.API_URL}/system`, data);
  }

  listExchangeRates(limit = 50): Observable<ExchangeRateRecord[]> {
    return this.http.get<ExchangeRateRecord[]>(`${this.API_URL}/exchange-rates?limit=${limit}`);
  }

  getRegisterSettings(registerId: string): Observable<RegisterSettings> {
    return this.http.get<RegisterSettings>(`${this.API_URL}/register/${registerId}`);
  }

  saveRegisterSettings(registerId: string, data: {
    defaultOpeningFloat?: number;
    currency?: string;
    warehouseId?: string;
    paymentMethods?: string[];
    denominations?: Array<{ value: number; enabled: boolean }>;
  }): Observable<RegisterSettings> {
    return this.http.put<RegisterSettings>(`${this.API_URL}/register/${registerId}`, data);
  }

  listPaymentMethods(): Observable<PaymentMethodSetting[]> {
    return this.http.get<PaymentMethodSetting[]>(`${this.API_URL}/payment-methods`);
  }

  savePaymentMethods(methods: { code: string; name: string; enabled: boolean }[]): Observable<any> {
    return this.http.put(`${this.API_URL}/payment-methods`, methods);
  }

  listDenominations(): Observable<Denomination[]> {
    return this.http.get<Denomination[]>(`${this.API_URL}/denominations`);
  }

  saveDenominations(denominations: { value: number; enabled: boolean }[]): Observable<any> {
    return this.http.put(`${this.API_URL}/denominations`, denominations);
  }
}
