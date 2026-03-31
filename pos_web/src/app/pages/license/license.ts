import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
    LicenseActivationRequest,
    LicenseService,
    LicenseStatusResponse
} from '@/app/core/services/license.service';

@Component({
    selector: 'app-license',
    standalone: true,
    imports: [CommonModule, FormsModule, CardModule, ButtonModule, TagModule, TextareaModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Licenciamiento Offline</h1>
                <p class="text-gray-500 m-0">
                    Gestiona la validez de uso del sistema en este dispositivo.
                </p>
            </div>

            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-4 pb-0 flex items-center justify-between">
                        <h3 class="m-0">Estado actual</h3>
                        <div class="flex gap-2">
                            <p-button
                                icon="pi pi-refresh"
                                label="Actualizar"
                                severity="secondary"
                                [outlined]="true"
                                [loading]="loadingStatus()"
                                (onClick)="loadStatus(true)"
                            />
                        </div>
                    </div>
                </ng-template>

                @if (status()) {
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-2">
                            <div>
                                <span class="text-gray-500">Estado:</span>
                                <p-tag
                                    class="ml-2"
                                    [value]="status()!.code"
                                    [severity]="status()!.valid ? 'success' : 'danger'"
                                />
                            </div>
                            <div><span class="text-gray-500">Mensaje:</span> {{ status()!.message }}</div>
                            <div><span class="text-gray-500">Hora servidor:</span> {{ status()!.serverTime | date:'dd/MM/yyyy HH:mm:ss' }}</div>
                            <div><span class="text-gray-500">Días restantes:</span> {{ status()!.daysRemaining ?? 'N/A' }}</div>
                            <div class="break-all"><span class="text-gray-500">Device hash:</span> <code>{{ status()!.deviceHash }}</code></div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <div><span class="text-gray-500">Licencia:</span> {{ status()!.license?.licenseId || 'Sin instalar' }}</div>
                            <div><span class="text-gray-500">Válida desde:</span> {{ status()!.license?.validFrom ? (status()!.license!.validFrom | date:'dd/MM/yyyy HH:mm:ss') : '-' }}</div>
                            <div><span class="text-gray-500">Expira:</span> {{ status()!.license?.expiresAt ? (status()!.license!.expiresAt | date:'dd/MM/yyyy HH:mm:ss') : '-' }}</div>
                            <div><span class="text-gray-500">Cliente:</span> {{ status()!.license?.customerName || '-' }}</div>
                            <div><span class="text-gray-500">Máx usuarios:</span> {{ status()!.license?.maxUsers ?? '-' }}</div>
                            <div><span class="text-gray-500">Features:</span> {{ (status()!.license?.features || []).join(', ') || '-' }}</div>
                        </div>
                    </div>
                } @else {
                    <div class="text-gray-500">No se pudo cargar el estado de la licencia.</div>
                }
            </p-card>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <p-card>
                    <ng-template pTemplate="header">
                        <div class="p-4 pb-0 flex items-center justify-between">
                            <h3 class="m-0">Solicitud de activación</h3>
                            <p-button
                                icon="pi pi-download"
                                label="Generar"
                                severity="secondary"
                                [loading]="loadingRequest()"
                                (onClick)="generateActivationRequest()"
                            />
                        </div>
                    </ng-template>

                    <div class="flex flex-col gap-2">
                        <textarea
                            pTextarea
                            [value]="activationRequestText"
                            rows="12"
                            class="w-full font-mono text-sm"
                            [readonly]="true"
                        ></textarea>
                        <div class="flex justify-end">
                            <p-button
                                icon="pi pi-copy"
                                label="Copiar"
                                severity="secondary"
                                [outlined]="true"
                                [disabled]="!activationRequestText.trim()"
                                (onClick)="copyActivationRequest()"
                            />
                        </div>
                    </div>
                </p-card>

                <p-card>
                    <ng-template pTemplate="header">
                        <div class="p-4 pb-0">
                            <h3 class="m-0">Instalar licencia</h3>
                        </div>
                    </ng-template>

                    <div class="flex flex-col gap-3">
                        <input type="file" accept=".json,.dat,.txt" (change)="onLicenseFileSelected($event)" />
                        <textarea
                            pTextarea
                            [(ngModel)]="licenseInputText"
                            rows="12"
                            class="w-full font-mono text-sm"
                            placeholder="Pegue aquí el contenido completo de license.dat"
                        ></textarea>
                        <div class="flex justify-end">
                            <p-button
                                icon="pi pi-check"
                                label="Activar licencia"
                                [loading]="activating()"
                                [disabled]="!licenseInputText.trim()"
                                (onClick)="activateLicense()"
                            />
                        </div>
                    </div>
                </p-card>
            </div>
        </div>

        <p-toast />
    `
})
export class LicensePage implements OnInit {
    loadingStatus = signal(false);
    loadingRequest = signal(false);
    activating = signal(false);
    status = signal<LicenseStatusResponse | null>(null);
    activationRequest = signal<LicenseActivationRequest | null>(null);

    activationRequestText = '';
    licenseInputText = '';

    constructor(
        private readonly licenseService: LicenseService,
        private readonly messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadStatus();
    }

    loadStatus(force = false) {
        this.loadingStatus.set(true);
        this.licenseService.getStatus(force).subscribe({
            next: (status) => {
                this.status.set(status);
                this.loadingStatus.set(false);
            },
            error: (err) => {
                this.loadingStatus.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo consultar el estado de licencia'
                });
            }
        });
    }

    generateActivationRequest() {
        this.loadingRequest.set(true);
        this.licenseService.getActivationRequest().subscribe({
            next: (payload) => {
                this.activationRequest.set(payload);
                this.activationRequestText = payload.requestText || JSON.stringify(payload, null, 2);
                this.loadingRequest.set(false);
            },
            error: (err) => {
                this.loadingRequest.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo generar la solicitud de activación'
                });
            }
        });
    }

    copyActivationRequest() {
        if (!this.activationRequestText.trim()) return;
        navigator.clipboard.writeText(this.activationRequestText).then(
            () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Copiado',
                    detail: 'Solicitud copiada al portapapeles'
                });
            },
            () => {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Advertencia',
                    detail: 'No se pudo copiar automáticamente. Copie manualmente.'
                });
            }
        );
    }

    onLicenseFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.licenseInputText = String(reader.result || '').trim();
        };
        reader.readAsText(file);
    }

    activateLicense() {
        const text = this.licenseInputText.trim();
        if (!text) return;

        this.activating.set(true);
        this.licenseService.activateLicense(text).subscribe({
            next: (status) => {
                this.status.set(status);
                this.activating.set(false);
                this.messageService.add({
                    severity: status.valid ? 'success' : 'warn',
                    summary: status.valid ? 'Licencia activa' : 'Licencia instalada',
                    detail: status.message
                });
            },
            error: (err) => {
                this.activating.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo activar la licencia'
                });
            }
        });
    }
}
