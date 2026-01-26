import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';

export interface PaymentMethodSetting {
  code: string; // CASH, CARD, TRANSFER, OTHER
  name: string;
  enabled: boolean;
}

export interface DenominationSetting {
  value: number;
  enabled: boolean;
}

export interface RegisterSettings {
  registerId: string;
  defaultOpeningFloat: number;
  currency: string;
  warehouseId: string;
  paymentMethods: PaymentMethodSetting[];
  denominations: DenominationSetting[];
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private http: HttpClient) {}

  getRegisterSettings(registerId: string) {
    return this.http.get<RegisterSettings>(`${API_BASE_URL}/api/settings/register/${encodeURIComponent(registerId)}`);
  }

  saveRegisterSettings(registerId: string, payload: Partial<{
    defaultOpeningFloat: number;
    currency: string;
    warehouseId: string;
    paymentMethods: string[];
    denominations: number[];
  }>) {
    return this.http.put<RegisterSettings>(`${API_BASE_URL}/api/settings/register/${encodeURIComponent(registerId)}`, payload);
  }

  listPaymentMethods() {
    return this.http.get<PaymentMethodSetting[]>(`${API_BASE_URL}/api/settings/payment-methods`);
  }

  savePaymentMethods(payload: PaymentMethodSetting[]) {
    return this.http.put(`${API_BASE_URL}/api/settings/payment-methods`, payload);
  }

  listDenominations() {
    return this.http.get<DenominationSetting[]>(`${API_BASE_URL}/api/settings/denominations`);
  }

  saveDenominations(payload: DenominationSetting[]) {
    return this.http.put('/api/settings/denominations', payload);
  }
}
