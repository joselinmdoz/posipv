import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  readonly baseUrl = Capacitor.isNativePlatform()
    ? environment.nativeApiBaseUrl
    : environment.webApiBaseUrl;
}
