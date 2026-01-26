import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductService } from '../../services/product.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
})
export class ProductsComponent {
  private readonly api = inject(ProductService);
  private readonly toast = inject(ToastService);

  readonly items = signal<Product[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  q = '';
  newName = '';
  newPrice: number | null = null;
  newCost: number | null = null;
  newUnit = '';
  newImage: File | null = null;
  newImagePreview: string | null = null;
  readonly showNew = signal(false);
  editingId: string | null = null;
  viewMode: 'table' | 'cards' = 'table';

  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  readonly filtered = computed(() => {
    const q = (this.q || '').toLowerCase().trim();
    const list = this.items();
    if (!q) return list;
    return list.filter((p) => {
      const hay = [p.name, p.sku ?? '', p.barcode ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  });

  constructor() {
    this.reload();
  }

  toggleNew() { this.showNew.set(!this.showNew()); }

  editProduct(product: Product) {
    this.editingId = product.id;
    this.newName = product.name;
    this.newPrice = product.price ? Number(product.price) : null;
    this.newCost = product.cost ? Number(product.cost) : null;
    this.newUnit = product.unit || '';
    this.newImage = null;
    this.newImagePreview = product.image || null;
    this.showNew.set(true);
  }

  cancelEdit() {
    this.editingId = null;
    this.resetForm();
  }

  openFileSelector() {
    this.imageInput.nativeElement.click();
  }

  private resetForm() {
    this.newName = '';
    this.newPrice = null;
    this.newCost = null;
    this.newUnit = '';
    this.newImage = null;
    this.newImagePreview = null;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.newImage = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.newImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  reload() {
    this.busy.set(true);
    this.error.set(null);
    this.api.list().pipe(
      catchError((e) => {
        this.error.set('products_failed');
        return of([]);
      }),
    ).subscribe((data) => {
      this.items.set(data);
      this.busy.set(false);
    });
  }

  create() {
    if (!this.newName || !this.newPrice) return;
    this.busy.set(true);

    const formData = new FormData();
    formData.append('name', this.newName);
    formData.append('price', this.newPrice.toString());
    if (this.newCost) formData.append('cost', this.newCost.toString());
    if (this.newUnit) formData.append('unit', this.newUnit);
    if (this.newImage) {
      formData.append('image', this.newImage);
    } else if (this.editingId && this.newImagePreview && !this.newImagePreview.startsWith('data:')) {
      // Si estamos editando y hay una imagen existente (no preview), incluirla
      formData.append('existingImage', this.newImagePreview);
    }

    const operation = this.editingId
      ? this.api.updateWithFile(this.editingId, formData)
      : this.api.createWithFile(formData);

    const successMessage = this.editingId ? 'Producto actualizado' : 'Producto creado';

    operation.pipe(
      catchError((e) => {
        this.toast.push({ kind: 'error', title: 'Error', message: 'Verifica el backend /api/products' });
        return of(null);
      }),
    ).subscribe((result) => {
      if (result) {
        this.toast.push({ kind: 'success', title: successMessage, message: result.name });
        if (this.editingId) {
          // Update existing item
          this.items.update((arr) => arr.map(p => p.id === this.editingId ? result : p));
        } else {
          // Add new item
          this.items.update((arr) => [result, ...arr]);
        }
        this.cancelEdit();
        this.showNew.set(false);
      }
      this.busy.set(false);
    });
  }

  money(price: string) {
    const v = Number(price);
    if (!isFinite(v)) return price;
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v);
  }
}
