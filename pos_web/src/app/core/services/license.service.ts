import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type LicenseStatusCode =
  | 'VALID'
  | 'MISSING'
  | 'INVALID_FORMAT'
  | 'PUBLIC_KEY_MISSING'
  | 'INVALID_SIGNATURE'
  | 'DEVICE_MISMATCH'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'CLOCK_ROLLBACK';

export interface LicenseStatusResponse {
  valid: boolean;
  code: LicenseStatusCode;
  message: string;
  serverTime: string;
  deviceHash: string;
  daysRemaining: number | null;
  license: null | {
    licenseId: string;
    issuedAt: string;
    validFrom: string;
    expiresAt: string;
    customerName?: string | null;
    maxUsers?: number | null;
    features: string[];
  };
}

export interface LicenseActivationRequest {
  requestVersion: number;
  generatedAt: string;
  systemName: string;
  fingerprint: {
    deviceHash: string;
    platform: string;
    arch: string;
    hostnameHash: string;
    machineIdHash: string;
    macHashes: string[];
  };
  requestText: string;
}

export type KeyPemSource = 'OVERRIDE_FILE' | 'ENV' | 'DEFAULT' | 'NONE';

export interface KeyPemResponse {
  source: KeyPemSource;
  publicKeyPem: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LicenseService {
  private readonly baseUrl = '/api/license';

  constructor(private readonly http: HttpClient) {}

  getStatus(refresh = false): Observable<LicenseStatusResponse> {
    let params = new HttpParams();
    if (refresh) {
      params = params.set('refresh', 'true');
    }
    return this.http.get<LicenseStatusResponse>(`${this.baseUrl}/status`, { params });
  }

  getActivationRequest(): Observable<LicenseActivationRequest> {
    return this.http.get<LicenseActivationRequest>(`${this.baseUrl}/activation-request`);
  }

  activateLicense(licenseText: string): Observable<LicenseStatusResponse> {
    return this.http.post<LicenseStatusResponse>(`${this.baseUrl}/activate`, {
      license: licenseText,
    });
  }

  readCurrentPublicKey(password: string): Observable<KeyPemResponse> {
    return this.http.post<KeyPemResponse>(`${this.baseUrl}/keypem/read`, { password });
  }

  updateCurrentPublicKey(password: string, publicKeyPem: string): Observable<KeyPemResponse> {
    return this.http.post<KeyPemResponse>(`${this.baseUrl}/keypem/update`, {
      password,
      publicKeyPem,
    });
  }
}
