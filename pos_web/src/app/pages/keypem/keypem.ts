import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { KeyPemSource, LicenseService } from '@/app/core/services/license.service';

@Component({
    selector: 'app-keypem-page',
    standalone: true,
    imports: [CommonModule, FormsModule, CardModule, ButtonModule, TextareaModule, ToastModule, TagModule, InputTextModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Gestión de Clave Pública (KEYPEM)</h1>
                <p class="text-gray-500 m-0">
                    Ruta de emergencia para consultar o cambiar la clave pública usada para validar licencias.
                </p>
            </div>

            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-4 pb-0">
                        <h3 class="m-0">Seguridad</h3>
                    </div>
                </ng-template>

                <div class="flex flex-col gap-3">
                    <label for="keypemPassword" class="font-medium">Contraseña de seguridad</label>
                    <input
                        id="keypemPassword"
                        pInputText
                        type="password"
                        [(ngModel)]="password"
                        autocomplete="off"
                        placeholder="Introduzca la contraseña"
                    />
                    <div class="flex justify-end">
                        <p-button
                            icon="pi pi-search"
                            label="Cargar clave actual"
                            [loading]="loadingRead()"
                            [disabled]="!password.trim()"
                            (onClick)="readCurrent()"
                        />
                    </div>
                </div>
            </p-card>

            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-4 pb-0 flex items-center justify-between">
                        <h3 class="m-0">Clave pública activa</h3>
                        <p-tag [value]="source()" [severity]="sourceSeverity(source())" />
                    </div>
                </ng-template>

                <div class="flex flex-col gap-3">
                    <textarea
                        pTextarea
                        [(ngModel)]="publicKeyPem"
                        rows="8"
                        class="w-full font-mono text-sm"
                        placeholder="Pegue aquí la clave pública PEM"
                    ></textarea>

                    <div class="flex gap-2 justify-end flex-wrap">
                        <p-button
                            icon="pi pi-undo"
                            label="Usar clave por defecto"
                            severity="secondary"
                            [outlined]="true"
                            (onClick)="useDefault()"
                        />
                        <p-button
                            icon="pi pi-save"
                            label="Guardar clave"
                            [loading]="loadingSave()"
                            [disabled]="!password.trim() || !publicKeyPem.trim()"
                            (onClick)="saveCurrent()"
                        />
                    </div>
                </div>
            </p-card>
        </div>

        <p-toast />
    `
})
export class KeyPemPage {
    readonly defaultKeyPem =
        '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA4vmHiLMKXkaIck2YYT+3EGiJCLVgKoMC7QLtW87qdcE=\n-----END PUBLIC KEY-----';

    password = '';
    publicKeyPem = this.defaultKeyPem;

    source = signal<KeyPemSource>('DEFAULT');
    loadingRead = signal(false);
    loadingSave = signal(false);

    constructor(
        private readonly licenseService: LicenseService,
        private readonly messageService: MessageService
    ) {}

    sourceSeverity(source: KeyPemSource) {
        if (source === 'OVERRIDE_FILE') return 'success';
        if (source === 'ENV') return 'info';
        if (source === 'DEFAULT') return 'warn';
        return 'danger';
    }

    useDefault() {
        this.publicKeyPem = this.defaultKeyPem;
    }

    readCurrent() {
        const pwd = this.password.trim();
        if (!pwd) return;

        this.loadingRead.set(true);
        this.licenseService.readCurrentPublicKey(pwd).subscribe({
            next: (res) => {
                this.publicKeyPem = res.publicKeyPem || '';
                this.source.set(res.source || 'NONE');
                this.loadingRead.set(false);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Clave cargada',
                    detail: `Origen: ${res.source}`
                });
            },
            error: (err) => {
                this.loadingRead.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo cargar la clave actual'
                });
            }
        });
    }

    saveCurrent() {
        const pwd = this.password.trim();
        const pem = this.publicKeyPem.trim();
        if (!pwd || !pem) return;

        this.loadingSave.set(true);
        this.licenseService.updateCurrentPublicKey(pwd, pem).subscribe({
            next: (res) => {
                this.publicKeyPem = res.publicKeyPem || pem;
                this.source.set(res.source || 'OVERRIDE_FILE');
                this.loadingSave.set(false);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Guardado',
                    detail: res.message || 'Clave pública actualizada'
                });
            },
            error: (err) => {
                this.loadingSave.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo guardar la clave pública'
                });
            }
        });
    }
}
