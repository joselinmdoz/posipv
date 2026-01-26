import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  timeoutMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  push(t: Omit<Toast, 'id'>) {
    const id = crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
    const toast: Toast = { id, timeoutMs: 3500, ...t };
    this._toasts.update((arr) => [...arr, toast]);

    const ms = toast.timeoutMs ?? 3500;
    if (ms > 0) setTimeout(() => this.dismiss(id), ms);
    return id;
  }

  dismiss(id: string) {
    this._toasts.update((arr) => arr.filter((t) => t.id !== id));
  }

  clear() {
    this._toasts.set([]);
  }
}
