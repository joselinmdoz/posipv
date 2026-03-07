import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import {
    AccountingAccount,
    AccountingPostingRule,
    AccountingPostingRuleKey,
    AccountingService
} from '@/app/core/services/accounting.service';
import { postingRuleLabel } from './accounting.shared';

@Component({
    selector: 'app-accounting-posting-rules',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, InputTextModule, SelectModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad · Reglas</h1>
                <p class="text-gray-500 m-0">Reglas automáticas para contabilización de ventas e inventario.</p>
            </div>

            <p-card header="Reglas de Contabilización Automática">
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <p-select [options]="postingRuleKeyOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.key" placeholder="Clave de regla" />
                        <input pInputText [(ngModel)]="postingRuleForm.name" placeholder="Nombre (opcional)" />
                        <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.debitAccountId" placeholder="Cuenta débito" />
                        <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.creditAccountId" placeholder="Cuenta crédito" />
                        <p-button label="Crear / Reactivar regla" icon="pi pi-plus" (onClick)="createPostingRule()" />
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadAll()" />
                        <p-button label="Restaurar reglas por defecto" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="seedDefaultPostingRules()" />
                    </div>

                    <div class="overflow-auto border rounded-lg">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-surface-100">
                                    <th class="text-left py-2 px-3">Regla</th>
                                    <th class="text-left py-2 px-3">Cuenta Débito</th>
                                    <th class="text-left py-2 px-3">Cuenta Crédito</th>
                                    <th class="text-left py-2 px-3">Activa</th>
                                    <th class="text-left py-2 px-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (rule of postingRules; track rule.id) {
                                    <tr>
                                        <td class="py-2 px-3 min-w-52">
                                            <div class="font-semibold">{{ postingRuleLabelFn(rule.key) }}</div>
                                            <div class="text-xs text-gray-500">{{ rule.key }}</div>
                                        </td>
                                        <td class="py-2 px-3 min-w-64">
                                            <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="rule.debitAccountId" [appendTo]="'body'" class="w-full" />
                                        </td>
                                        <td class="py-2 px-3 min-w-64">
                                            <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="rule.creditAccountId" [appendTo]="'body'" class="w-full" />
                                        </td>
                                        <td class="py-2 px-3">
                                            <input type="checkbox" [(ngModel)]="rule.active" />
                                        </td>
                                        <td class="py-2 px-3">
                                            <div class="flex flex-wrap gap-1">
                                                <p-button size="small" icon="pi pi-save" label="Guardar" (onClick)="savePostingRule(rule)" />
                                                <p-button size="small" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deletePostingRule(rule)" />
                                            </div>
                                        </td>
                                    </tr>
                                }
                                @if (!postingRules.length) {
                                    <tr>
                                        <td colspan="5" class="text-center py-3 text-gray-500">Sin reglas contables configuradas</td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-card>

            <p-toast />
        </div>
    `
})
export class AccountingPostingRules implements OnInit {
    postingRules: AccountingPostingRule[] = [];
    accounts: AccountingAccount[] = [];
    ruleAccountOptions: Array<{ label: string; value: string }> = [];
    postingRuleKeyOptions: Array<{ label: string; value: AccountingPostingRuleKey }> = [];

    postingRuleForm: {
        key: AccountingPostingRuleKey;
        name: string;
        debitAccountId: string;
        creditAccountId: string;
    } = {
        key: 'SALE_REVENUE_CUP',
        name: '',
        debitAccountId: '',
        creditAccountId: ''
    };

    constructor(
        private accountingService: AccountingService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.rebuildPostingRuleKeyOptions();
        setTimeout(() => this.loadAll(), 0);
    }

    postingRuleLabelFn(key: AccountingPostingRuleKey): string {
        return postingRuleLabel(key);
    }

    loadAll() {
        this.loadAccounts();
        this.loadPostingRules();
    }

    loadAccounts() {
        this.accountingService.listAccounts({ limit: 1000 }).subscribe({
            next: (rows) => {
                this.accounts = rows || [];
                this.ruleAccountOptions = this.accounts
                    .filter((acc) => acc.active)
                    .map((acc) => ({ label: `${acc.code} - ${acc.name}`, value: acc.id }));
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las cuentas')
        });
    }

    loadPostingRules() {
        this.accountingService.listPostingRules().subscribe({
            next: (rows) => {
                this.postingRules = rows || [];
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las reglas contables')
        });
    }

    rebuildPostingRuleKeyOptions() {
        const keys: AccountingPostingRuleKey[] = ['SALE_REVENUE_CUP', 'SALE_REVENUE_USD', 'SALE_COGS', 'STOCK_IN', 'STOCK_OUT'];
        this.postingRuleKeyOptions = keys.map((key) => ({
            label: `${postingRuleLabel(key)} (${key})`,
            value: key
        }));
    }

    createPostingRule() {
        this.accountingService
            .createPostingRule({
                key: this.postingRuleForm.key,
                name: this.postingRuleForm.name || undefined,
                debitAccountId: this.postingRuleForm.debitAccountId || undefined,
                creditAccountId: this.postingRuleForm.creditAccountId || undefined,
                active: true
            })
            .subscribe({
                next: () => {
                    this.success('Regla creada/reactivada');
                    this.postingRuleForm = {
                        key: this.postingRuleForm.key,
                        name: '',
                        debitAccountId: '',
                        creditAccountId: ''
                    };
                    this.loadPostingRules();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo crear/reactivar la regla')
            });
    }

    savePostingRule(rule: AccountingPostingRule) {
        this.accountingService
            .updatePostingRule(rule.key, {
                name: rule.name,
                description: rule.description || undefined,
                active: rule.active,
                debitAccountId: rule.debitAccountId,
                creditAccountId: rule.creditAccountId
            })
            .subscribe({
                next: (saved) => {
                    const idx = this.postingRules.findIndex((r) => r.id === saved.id);
                    if (idx >= 0) this.postingRules[idx] = saved;
                    this.success(`Regla ${this.postingRuleLabelFn(saved.key)} actualizada`);
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo actualizar la regla')
            });
    }

    deletePostingRule(rule: AccountingPostingRule) {
        const ok = window.confirm(`¿Desactivar regla "${this.postingRuleLabelFn(rule.key)}"?`);
        if (!ok) return;
        this.accountingService.deletePostingRule(rule.key).subscribe({
            next: () => {
                this.success(`Regla ${this.postingRuleLabelFn(rule.key)} desactivada`);
                this.loadPostingRules();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo desactivar la regla')
        });
    }

    seedDefaultPostingRules() {
        this.accountingService.seedDefaultPostingRules().subscribe({
            next: (rows) => {
                this.postingRules = rows || [];
                this.success('Reglas por defecto cargadas');
                this.cdr.markForCheck();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudieron cargar las reglas por defecto')
        });
    }

    private success(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
