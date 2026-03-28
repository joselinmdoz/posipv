import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface RegisterSettings {
  id: string;
  registerId: string;
  defaultOpeningFloat: number;
  currency: string;
  warehouseId?: string;
  sellerEmployeeIds?: string[];
  allowedEmployees?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    active: boolean;
    userId: string | null;
    user?: {
      id: string;
      email: string;
      active: boolean;
    } | null;
  }>;
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
  currency: SystemCurrencyCode;
}

export type SystemCurrencyCode = 'CUP' | 'USD';

export interface SystemSettings {
  id: string;
  defaultCurrency: SystemCurrencyCode;
  enabledCurrencies: SystemCurrencyCode[];
  exchangeRateUsdToCup: number;
  systemName: string;
  systemLogoUrl: string | null;
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
  private readonly API_URL = '/api/settings';
  private readonly systemSettingsState = new BehaviorSubject<SystemSettings | null>(null);

  constructor(private http: HttpClient) {}

  getSystemSettings(): Observable<SystemSettings> {
    return this.http.get<SystemSettings>(`${this.API_URL}/system`).pipe(
      tap((settings) => this.systemSettingsState.next(settings))
    );
  }

  saveSystemSettings(data: {
    defaultCurrency?: SystemCurrencyCode;
    enabledCurrencies?: SystemCurrencyCode[];
    exchangeRateUsdToCup?: number;
    systemName?: string;
    systemLogoUrl?: string | null;
  }): Observable<SystemSettings> {
    return this.http.put<SystemSettings>(`${this.API_URL}/system`, data).pipe(
      tap((settings) => this.systemSettingsState.next(settings))
    );
  }

  watchSystemSettings(): Observable<SystemSettings | null> {
    return this.systemSettingsState.asObservable();
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
    sellerEmployeeIds?: string[];
    paymentMethods?: string[];
    denominations?: Array<{ value: number; enabled: boolean; currency?: SystemCurrencyCode }>;
  }): Observable<RegisterSettings> {
    return this.http.put<RegisterSettings>(`${this.API_URL}/register/${registerId}`, data);
  }

  listPaymentMethods(): Observable<PaymentMethodSetting[]> {
    return this.http.get<PaymentMethodSetting[]>(`${this.API_URL}/payment-methods`);
  }

  savePaymentMethods(methods: { code: string; name: string; enabled: boolean }[]): Observable<any> {
    return this.http.put(`${this.API_URL}/payment-methods`, methods);
  }

  listDenominations(filters?: { registerId?: string; currency?: SystemCurrencyCode }): Observable<Denomination[]> {
    const params = new URLSearchParams();
    if (filters?.registerId) params.set('registerId', filters.registerId);
    if (filters?.currency) params.set('currency', filters.currency);
    const query = params.toString();
    return this.http.get<Denomination[]>(`${this.API_URL}/denominations${query ? `?${query}` : ''}`);
  }

  saveDenominations(denominations: { value: number; enabled: boolean; currency?: SystemCurrencyCode }[]): Observable<any> {
    return this.http.put(`${this.API_URL}/denominations`, denominations);
  }
}
