import { Component, computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { PosService } from '../core/services/pos.service';
import { CartItem, CurrencyCode, PaymentMethodCode, SessionProduct } from '../core/models/pos.model';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.page.html',
  styleUrls: ['./pos.page.scss'],
  standalone: false
})
export class PosPage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly posService = inject(PosService);

  readonly user$ = this.authService.user$;
  readonly cart = this.posService.cart;
  readonly cartTotal = this.posService.cartTotal;
  readonly cartCount = computed(() => this.posService.cart().reduce((sum, item) => sum + item.qty, 0));

  session = this.posService.currentSession();
  products: SessionProduct[] = [];
  query = '';

  loadingProducts = false;
  processingSale = false;

  saleStatus = '';
  saleStatusIsError = false;

  registerCurrency: CurrencyCode = 'CUP';
  paymentMethodOptions: Array<{ code: PaymentMethodCode; label: string }> = [
    { code: 'CASH', label: 'Efectivo' },
    { code: 'CARD', label: 'Tarjeta' },
    { code: 'TRANSFER', label: 'Transferencia' },
    { code: 'OTHER', label: 'Otro' }
  ];
  selectedPaymentMethod: PaymentMethodCode = 'CASH';

  readonly filteredProducts = computed(() => {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.products;
    return this.products.filter((item) =>
      item.name.toLowerCase().includes(q) || (item.codigo || '').toLowerCase().includes(q)
    );
  });

  ionViewWillEnter(): void {
    this.session = this.posService.currentSession();
    if (!this.session || this.session.status !== 'OPEN') {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    this.loadRegisterContext();
    this.loadProducts();
  }

  goHome(): void {
    this.router.navigateByUrl('/home');
  }

  addProduct(product: SessionProduct): void {
    this.saleStatus = '';
    this.posService.addToCart(product);
  }

  increase(item: CartItem): void {
    this.posService.updateCartItemQty(item.productId, item.qty + 1);
  }

  decrease(item: CartItem): void {
    this.posService.updateCartItemQty(item.productId, item.qty - 1);
  }

  remove(item: CartItem): void {
    this.posService.removeFromCart(item.productId);
  }

  clearCart(): void {
    this.posService.clearCart();
  }

  checkout(): void {
    if (!this.session || this.processingSale) return;
    if (this.posService.cart().length === 0) {
      this.setSaleMessage('El carrito esta vacio.', true);
      return;
    }

    const total = this.cartTotal();
    this.processingSale = true;
    this.saleStatus = '';

    this.posService
      .createSale(this.session.id, this.posService.cart(), [
        {
          method: this.selectedPaymentMethod,
          amount: total,
          currency: this.registerCurrency
        }
      ])
      .pipe(finalize(() => (this.processingSale = false)))
      .subscribe({
        next: (result) => {
          this.setSaleMessage(`Venta registrada (${result.documentNumber}).`, false);
          this.posService.clearCart();
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.setSaleMessage(this.resolveErrorMessage(error), true);
        }
      });
  }

  getQtyAvailable(product: SessionProduct): number {
    return Number(product.qtyAvailable || 0);
  }

  private loadProducts(): void {
    if (!this.session) return;
    this.loadingProducts = true;
    this.posService
      .listSessionProducts(this.session.id)
      .pipe(finalize(() => (this.loadingProducts = false)))
      .subscribe({
        next: (products) => {
          this.products = products;
        },
        error: (error: HttpErrorResponse) => {
          this.setSaleMessage(this.resolveErrorMessage(error), true);
        }
      });
  }

  private loadRegisterContext(): void {
    if (!this.session) return;
    this.posService.getRegisterSettings(this.session.registerId).subscribe({
      next: (settings) => {
        this.registerCurrency = this.posService.normalizeCurrency(settings.currency);

        const normalized = (settings.paymentMethods || [])
          .filter((pm) => pm.enabled)
          .map((pm) => this.posService.normalizePaymentMethod(pm.code))
          .filter((method): method is PaymentMethodCode => !!method);

        const uniqueMethods = Array.from(new Set(normalized));
        if (uniqueMethods.length === 0) return;

        const labels: Record<PaymentMethodCode, string> = {
          CASH: 'Efectivo',
          CARD: 'Tarjeta',
          TRANSFER: 'Transferencia',
          OTHER: 'Otro'
        };

        this.paymentMethodOptions = uniqueMethods.map((code) => ({
          code,
          label: labels[code]
        }));
        this.selectedPaymentMethod = this.paymentMethodOptions[0].code;
      },
      error: () => {
        // Fallback silencioso: se mantienen métodos por defecto.
      }
    });
  }

  private setSaleMessage(message: string, isError: boolean): void {
    this.saleStatus = message;
    this.saleStatusIsError = isError;
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se pudo conectar al servidor.';
    }
    const apiMessage = error.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (Array.isArray(apiMessage) && apiMessage.length > 0) return String(apiMessage[0]);
    if (error.status === 401) return 'Sesion expirada. Vuelve a iniciar sesion.';
    return 'No se pudo completar la operacion.';
  }
}
