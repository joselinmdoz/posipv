import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface HealthResponse {
  ok: boolean;
  service: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  check(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.apiConfig.baseUrl}/health`);
  }
}
