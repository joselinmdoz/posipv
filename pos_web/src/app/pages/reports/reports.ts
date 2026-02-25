import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem, MessageService } from 'primeng/api';
import { DetailedSale, ReportsService, SalesReport } from '@/app/core/services/reports.service';

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, TableModule, CardModule, DialogModule, ToastModule, SplitButtonModule],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h1 class="text-2xl font-bold m-0">Reportes de Ventas</h1>
                    <p class="m-0 mt-1 text-sm text-gray-600">
                        Fechas y horas calculadas por servidor
                        @if (serverTimezone()) { ({{ serverTimezone() }}) }
                    </p>
                </div>
                <p-splitbutton
                    label="Exportar"
                    icon="pi pi-download"
                    severity="secondary"
                    [outlined]="true"
                    [model]="exportItems"
                    [disabled]="!report() || loading()"
                />
            </div>

            <p-card class="mb-4">
                <div class="flex gap-4 items-end flex-wrap">
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Fecha desde</label>
                        <p-datepicker [(ngModel)]="startDate" dateFormat="yy-mm-dd" [showIcon]="true" styleClass="w-full" [disabled]="loading()" />
                    </div>
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Fecha hasta</label>
                        <p-datepicker [(ngModel)]="endDate" dateFormat="yy-mm-dd" [showIcon]="true" styleClass="w-full" [disabled]="loading()" />
                    </div>
                    <p-button label="Generar Reporte" icon="pi pi-chart-bar" [loading]="loading()" (onClick)="generateReport()" />
                </div>
            </p-card>

            @if (report()) {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <p-card>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-primary">{{ report()?.totalSales }}</div>
                            <div class="text-gray-500">Total de Ventas</div>
                        </div>
                    </p-card>
                    <p-card>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-green-600">{{ report()?.totalAmount | currency }}</div>
                            <div class="text-gray-500">Monto Total</div>
                        </div>
                    </p-card>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <p-card header="Ventas por Método de Pago">
                        <p-table [value]="report()?.salesByPaymentMethod || []">
                            <ng-template #header>
                                <tr>
                                    <th>Método</th>
                                    <th>Monto</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-item>
                                <tr>
                                    <td>{{ getPaymentMethodLabel(item.method) }}</td>
                                    <td>{{ item.amount | currency }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </p-card>

                    <p-card header="Ventas por Cajero">
                        <p-table [value]="report()?.salesByCashier || []">
                            <ng-template #header>
                                <tr>
                                    <th>Cajero</th>
                                    <th>Ventas</th>
                                    <th>Monto</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-item>
                                <tr>
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.sales }}</td>
                                    <td>{{ item.amount | currency }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </p-card>
                </div>

                <p-card header="Detalle de Ventas">
                    <p-table [value]="report()?.detailedSales || []" [paginator]="true" [rows]="10">
                        <ng-template #header>
                            <tr>
                                <th>Fecha</th>
                                <th>Cajero</th>
                                <th>Total</th>
                                <th>Estado</th>
                                <th class="text-center">Opciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-sale>
                            <tr>
                                <td>{{ sale.createdAtServer || formatDateTime(sale.createdAt) }}</td>
                                <td>{{ sale.cashier?.email || 'N/A' }}</td>
                                <td>{{ sale.total | currency }}</td>
                                <td>
                                    <span [class]="sale.status === 'PAID' ? 'text-green-600' : 'text-red-600'">
                                        {{ sale.status }}
                                    </span>
                                </td>
                                <td class="text-center">
                                    <p-button
                                        icon="pi pi-eye"
                                        [rounded]="true"
                                        [text]="true"
                                        severity="secondary"
                                        (onClick)="openSaleDetail(sale)"
                                    />
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="5" class="text-center">No hay ventas en el período seleccionado.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </p-card>
            }
        </div>

        <p-dialog
            header="Detalle de Venta"
            [(visible)]="saleDetailDialog"
            [modal]="true"
            [style]="{ width: '980px' }"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
        >
            @if (selectedSale()) {
                <div class="flex flex-col gap-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                            <span class="text-gray-500">Fecha servidor:</span>
                            <strong class="ml-2">{{ selectedSale()!.createdAtServer || formatDateTime(selectedSale()!.createdAt) }}</strong>
                        </div>
                        <div>
                            <span class="text-gray-500">Cajero:</span>
                            <strong class="ml-2">{{ selectedSale()!.cashier.email || 'N/A' }}</strong>
                        </div>
                        <div>
                            <span class="text-gray-500">Estado:</span>
                            <strong class="ml-2">{{ selectedSale()!.status }}</strong>
                        </div>
                        <div>
                            <span class="text-gray-500">Total:</span>
                            <strong class="ml-2">{{ selectedSale()!.total | currency }}</strong>
                        </div>
                    </div>

                    <p-card header="Productos vendidos">
                        <p-table [value]="selectedSale()!.items || []">
                            <ng-template #header>
                                <tr>
                                    <th>Producto</th>
                                    <th>Código</th>
                                    <th class="text-right">Cantidad</th>
                                    <th class="text-right">Precio</th>
                                    <th class="text-right">Subtotal</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-item>
                                <tr>
                                    <td>{{ item.product?.name || 'Producto sin nombre' }}</td>
                                    <td>{{ item.product?.codigo || item.product?.barcode || '-' }}</td>
                                    <td class="text-right">{{ item.qty }}</td>
                                    <td class="text-right">{{ item.price | currency }}</td>
                                    <td class="text-right">{{ lineSubtotal(item) | currency }}</td>
                                </tr>
                            </ng-template>
                            <ng-template #emptymessage>
                                <tr>
                                    <td colspan="5" class="text-center">Esta venta no tiene productos asociados.</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </p-card>

                    <p-card header="Pagos de la venta">
                        <p-table [value]="selectedSale()!.payments || []">
                            <ng-template #header>
                                <tr>
                                    <th>Método</th>
                                    <th class="text-right">Monto</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-payment>
                                <tr>
                                    <td>{{ getPaymentMethodLabel(payment.method) }}</td>
                                    <td class="text-right">{{ payment.amount | currency }}</td>
                                </tr>
                            </ng-template>
                            <ng-template #emptymessage>
                                <tr>
                                    <td colspan="2" class="text-center">Esta venta no tiene pagos registrados.</td>
                                </tr>
                            </ng-template>
                        </p-table>
                        <div class="flex justify-end pt-3 text-sm">
                            <span class="text-gray-500 mr-2">Total pagado:</span>
                            <strong>{{ salePaymentsTotal(selectedSale()!) | currency }}</strong>
                        </div>
                    </p-card>
                </div>
            }
            <ng-template #footer>
                <p-button label="Cerrar" icon="pi pi-times" text (onClick)="saleDetailDialog = false" />
            </ng-template>
        </p-dialog>

        <p-toast />
    `
})
export class Reports implements OnInit {
    startDate: Date | null = null;
    endDate: Date | null = null;
    report = signal<SalesReport | null>(null);
    loading = signal<boolean>(false);
    serverTimezone = signal<string>('');
    selectedSale = signal<DetailedSale | null>(null);
    saleDetailDialog = false;

    exportItems: MenuItem[] = [
        {
            label: 'Exportar XLSX',
            icon: 'pi pi-file-excel',
            command: () => this.exportSalesAsXlsx()
        },
        {
            label: 'Exportar PDF',
            icon: 'pi pi-file-pdf',
            command: () => this.exportSalesAsPdf()
        }
    ];

    constructor(
        private reportsService: ReportsService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadServerTodayReport();
    }

    loadServerTodayReport() {
        this.loading.set(true);
        this.reportsService.getSalesReport().subscribe({
            next: (report) => {
                this.applyReport(report);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el reporte de hoy del servidor.'
                });
            }
        });
    }

    generateReport() {
        if (!this.startDate || !this.endDate) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Rango inválido',
                detail: 'Seleccione fecha inicial y final.'
            });
            return;
        }

        if (this.startDate.getTime() > this.endDate.getTime()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Rango inválido',
                detail: 'La fecha desde no puede ser mayor que la fecha hasta.'
            });
            return;
        }

        const startStr = this.formatDate(this.startDate);
        const endStr = this.formatDate(this.endDate);

        this.loading.set(true);
        this.reportsService.getSalesReport(startStr, endStr).subscribe({
            next: (report) => {
                this.applyReport(report);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al generar reporte'
                });
            }
        });
    }

    exportSalesAsXlsx() {
        const report = this.report();
        if (!report) {
            this.messageService.add({ severity: 'warn', summary: 'Sin reporte', detail: 'Primero genere el reporte.' });
            return;
        }

        const rows = this.buildSalesExportRows(report);
        const sheetXml = this.buildXlsxSheet(rows);
        const xlsxBlob = this.buildXlsxZipBlob(sheetXml);
        this.downloadBlob(
            xlsxBlob,
            `reporte-ventas-${this.formatFileDate(new Date())}.xlsx`
        );
    }

    exportSalesAsPdf() {
        const report = this.report();
        if (!report) {
            this.messageService.add({ severity: 'warn', summary: 'Sin reporte', detail: 'Primero genere el reporte.' });
            return;
        }

        const lines = this.buildSalesPdfLines(report);
        const pdfBlob = this.buildSimplePdfBlob(lines);
        this.downloadBlob(
            pdfBlob,
            `reporte-ventas-${this.formatFileDate(new Date())}.pdf`
        );
    }

    openSaleDetail(sale: DetailedSale) {
        this.selectedSale.set(sale);
        this.saleDetailDialog = true;
    }

    lineSubtotal(item: { qty: number; price: number }) {
        return Number(item.qty || 0) * Number(item.price || 0);
    }

    salePaymentsTotal(sale: DetailedSale) {
        return (sale.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    }

    private buildSalesExportRows(report: SalesReport): Array<Array<string | number>> {
        const rows: Array<Array<string | number>> = [
            ['REPORTE DE VENTAS'],
            ['Zona horaria servidor', report.serverTimezone || '-'],
            ['Desde', report.startDate || '-'],
            ['Hasta', report.endDate || '-'],
            [],
            ['RESUMEN'],
            ['Total de ventas', report.totalSales],
            ['Monto total', report.totalAmount],
            [],
            ['VENTAS POR METODO DE PAGO'],
            ['Metodo', 'Monto']
        ];

        for (const row of report.salesByPaymentMethod || []) {
            rows.push([this.getPaymentMethodLabel(row.method), Number(row.amount || 0)]);
        }

        rows.push([]);
        rows.push(['VENTAS POR CAJERO']);
        rows.push(['Cajero', 'Ventas', 'Monto']);

        for (const row of report.salesByCashier || []) {
            rows.push([row.name || 'N/A', Number(row.sales || 0), Number(row.amount || 0)]);
        }

        rows.push([]);
        rows.push(['DETALLE DE VENTAS']);
        rows.push(['ID', 'Fecha', 'Cajero', 'Total', 'Estado']);

        for (const sale of report.detailedSales || []) {
            rows.push([
                sale.id || '',
                sale.createdAtServer || this.formatDateTime(sale.createdAt),
                sale.cashier?.email || 'N/A',
                Number(sale.total || 0),
                sale.status || ''
            ]);
        }

        return rows;
    }

    private buildSalesPdfLines(report: SalesReport): string[] {
        const lines: string[] = [
            'REPORTE DE VENTAS',
            '',
            `Zona horaria servidor: ${report.serverTimezone || '-'}`,
            `Desde: ${report.startDate || '-'}`,
            `Hasta: ${report.endDate || '-'}`,
            '',
            'RESUMEN',
            `Total de ventas: ${report.totalSales}`,
            `Monto total: ${Number(report.totalAmount || 0).toFixed(2)}`,
            '',
            'VENTAS POR METODO DE PAGO'
        ];

        for (const row of report.salesByPaymentMethod || []) {
            lines.push(`${this.getPaymentMethodLabel(row.method)}: ${Number(row.amount || 0).toFixed(2)}`);
        }

        lines.push('');
        lines.push('VENTAS POR CAJERO');
        for (const row of report.salesByCashier || []) {
            lines.push(`${row.name || 'N/A'} | Ventas: ${row.sales} | Monto: ${Number(row.amount || 0).toFixed(2)}`);
        }

        lines.push('');
        lines.push('DETALLE DE VENTAS');
        lines.push('ID | Fecha | Cajero | Total | Estado');
        for (const sale of report.detailedSales || []) {
            lines.push(
                this.truncateForPdf(
                    `${sale.id || ''} | ${sale.createdAtServer || this.formatDateTime(sale.createdAt)} | ${sale.cashier?.email || 'N/A'} | ${Number(sale.total || 0).toFixed(2)} | ${sale.status || ''}`,
                    115
                )
            );
        }

        return lines;
    }

    formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getPaymentMethodLabel(method: string): string {
        const labels: Record<string, string> = {
            CASH: 'Efectivo',
            CARD: 'Tarjeta',
            TRANSFER: 'Transferencia',
            OTHER: 'Otro'
        };
        return labels[method] || method;
    }

    formatDateTime(value: string | Date | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';

        const formatter = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        return formatter.format(date);
    }

    private buildXlsxSheet(rows: Array<Array<string | number>>): string {
        const rowXml = rows
            .map((row, rowIndex) => {
                const cellsXml = row
                    .map((value, columnIndex) => this.buildXlsxCell(value, rowIndex + 1, columnIndex + 1))
                    .join('');
                return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
            })
            .join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
    }

    private buildXlsxCell(value: string | number, row: number, column: number): string {
        const ref = `${this.columnToLetters(column)}${row}`;
        if (typeof value === 'number') {
            return `<c r="${ref}" t="n"><v>${Number(value)}</v></c>`;
        }
        const escapedValue = this.escapeXml(value ?? '');
        return `<c r="${ref}" t="inlineStr"><is><t>${escapedValue}</t></is></c>`;
    }

    private buildXlsxZipBlob(sheetXml: string): Blob {
        const encoder = new TextEncoder();
        const entries: Array<{ name: string; content: Uint8Array }> = [
            {
                name: '[Content_Types].xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`)
            },
            {
                name: '_rels/.rels',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
            },
            {
                name: 'xl/workbook.xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Ventas" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`)
            },
            {
                name: 'xl/_rels/workbook.xml.rels',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`)
            },
            {
                name: 'xl/styles.xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`)
            },
            {
                name: 'xl/worksheets/sheet1.xml',
                content: encoder.encode(sheetXml)
            }
        ];

        return this.buildZip(entries, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    private buildSimplePdfBlob(lines: string[]): Blob {
        const linesPerPage = 45;
        const pages: string[][] = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }

        const objects: string[] = [];
        const pageIds: number[] = [];
        const contentIds: number[] = [];
        let objectId = 4;

        for (let index = 0; index < pages.length; index++) {
            pageIds.push(objectId++);
            contentIds.push(objectId++);
        }

        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
        objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        for (let index = 0; index < pages.length; index++) {
            const content = this.buildPdfContent(pages[index]);
            const pageId = pageIds[index];
            const contentId = contentIds[index];
            objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
            objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
        }

        let pdf = '%PDF-1.4\n';
        const offsets: number[] = [0];
        for (let i = 1; i < objects.length; i++) {
            if (!objects[i]) continue;
            offsets[i] = pdf.length;
            pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefStart = pdf.length;
        pdf += `xref\n0 ${objects.length}\n`;
        pdf += '0000000000 65535 f \n';
        for (let i = 1; i < objects.length; i++) {
            const offset = offsets[i] || 0;
            pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    }

    private buildPdfContent(lines: string[]): string {
        const safeLines = lines.map((line) => this.escapePdfText(this.toAscii(line)));
        const content: string[] = ['BT', '/F1 10 Tf', '14 TL', '40 805 Td'];
        for (let i = 0; i < safeLines.length; i++) {
            content.push(`(${safeLines[i]}) Tj`);
            if (i < safeLines.length - 1) content.push('T*');
        }
        content.push('ET');
        return content.join('\n');
    }

    private buildZip(entries: Array<{ name: string; content: Uint8Array }>, mimeType: string): Blob {
        const fileParts: Uint8Array[] = [];
        const centralParts: Uint8Array[] = [];
        let offset = 0;
        let centralDirectorySize = 0;

        for (const entry of entries) {
            const nameBytes = new TextEncoder().encode(entry.name);
            const crc = this.crc32(entry.content);
            const localHeader = new Uint8Array(30);
            const localView = new DataView(localHeader.buffer);

            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, 20, true);
            localView.setUint16(6, 0, true);
            localView.setUint16(8, 0, true);
            localView.setUint16(10, 0, true);
            localView.setUint16(12, 0, true);
            localView.setUint32(14, crc, true);
            localView.setUint32(18, entry.content.length, true);
            localView.setUint32(22, entry.content.length, true);
            localView.setUint16(26, nameBytes.length, true);
            localView.setUint16(28, 0, true);
            fileParts.push(localHeader, nameBytes, entry.content);

            const centralHeader = new Uint8Array(46);
            const centralView = new DataView(centralHeader.buffer);
            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, 20, true);
            centralView.setUint16(6, 20, true);
            centralView.setUint16(8, 0, true);
            centralView.setUint16(10, 0, true);
            centralView.setUint16(12, 0, true);
            centralView.setUint16(14, 0, true);
            centralView.setUint32(16, crc, true);
            centralView.setUint32(20, entry.content.length, true);
            centralView.setUint32(24, entry.content.length, true);
            centralView.setUint16(28, nameBytes.length, true);
            centralView.setUint16(30, 0, true);
            centralView.setUint16(32, 0, true);
            centralView.setUint16(34, 0, true);
            centralView.setUint16(36, 0, true);
            centralView.setUint32(38, 0, true);
            centralView.setUint32(42, offset, true);
            centralParts.push(centralHeader, nameBytes);

            const localSize = localHeader.length + nameBytes.length + entry.content.length;
            offset += localSize;
            centralDirectorySize += centralHeader.length + nameBytes.length;
        }

        const endHeader = new Uint8Array(22);
        const endView = new DataView(endHeader.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, entries.length, true);
        endView.setUint16(10, entries.length, true);
        endView.setUint32(12, centralDirectorySize, true);
        endView.setUint32(16, offset, true);
        endView.setUint16(20, 0, true);

        const blobParts: BlobPart[] = [...fileParts, ...centralParts, endHeader].map((part) => {
            const copy = new Uint8Array(part.byteLength);
            copy.set(part);
            return copy.buffer;
        });
        return new Blob(blobParts, { type: mimeType });
    }

    private crc32(bytes: Uint8Array): number {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) {
            crc ^= bytes[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    private downloadBlob(blob: Blob, fileName: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    private columnToLetters(column: number): string {
        let num = column;
        let letters = '';
        while (num > 0) {
            const remainder = (num - 1) % 26;
            letters = String.fromCharCode(65 + remainder) + letters;
            num = Math.floor((num - 1) / 26);
        }
        return letters;
    }

    private escapeXml(value: string): string {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll('\'', '&apos;');
    }

    private escapePdfText(value: string): string {
        return value
            .replaceAll('\\', '\\\\')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)');
    }

    private toAscii(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7e]/g, '');
    }

    private formatFileDate(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        const hours = `${date.getHours()}`.padStart(2, '0');
        const minutes = `${date.getMinutes()}`.padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    private truncateForPdf(value: string, maxLength: number): string {
        if (value.length <= maxLength) return value;
        return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
    }

    private applyReport(report: SalesReport) {
        this.report.set(report);
        this.serverTimezone.set(report.serverTimezone || '');
        this.startDate = this.parseYmd(report.startDate) || this.startDate;
        this.endDate = this.parseYmd(report.endDate) || this.endDate;
    }

    private parseYmd(value?: string | null): Date | null {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const [yearText, monthText, dayText] = value.split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        if (
            Number.isNaN(date.getTime()) ||
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }
        return date;
    }
}
