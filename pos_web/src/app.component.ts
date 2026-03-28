import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { SettingsService } from '@/app/core/services/settings.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit, OnDestroy {
    private readonly title = inject(Title);
    private readonly settingsService = inject(SettingsService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly defaultSystemName = 'POS System';
    private readonly defaultFaviconHref = this.getCurrentFaviconHref();

    private readonly onFocusIn = (event: FocusEvent) => {
        this.scheduleSelect(event.target);
    };

    private readonly onPointerUp = (event: PointerEvent) => {
        const target = event.target;
        if (!this.isSelectableTextField(target)) return;
        if (document.activeElement !== target) return;
        this.scheduleSelect(target);
    };

    ngOnInit(): void {
        document.addEventListener('focusin', this.onFocusIn, true);
        document.addEventListener('pointerup', this.onPointerUp, true);
        this.bindSystemBranding();
    }

    ngOnDestroy(): void {
        document.removeEventListener('focusin', this.onFocusIn, true);
        document.removeEventListener('pointerup', this.onPointerUp, true);
    }

    private scheduleSelect(target: EventTarget | null): void {
        if (!this.isSelectableTextField(target)) return;
        setTimeout(() => target.select(), 0);
    }

    private bindSystemBranding(): void {
        this.settingsService
            .watchSystemSettings()
            .pipe(
                filter((settings): settings is NonNullable<typeof settings> => !!settings),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((settings) => {
                this.applySystemBranding(settings.systemName, settings.systemLogoUrl);
            });

        this.settingsService
            .getSystemSettings()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (settings) => this.applySystemBranding(settings.systemName, settings.systemLogoUrl),
                error: () => this.applySystemBranding(this.defaultSystemName, null)
            });
    }

    private applySystemBranding(systemName: string | null | undefined, systemLogoUrl: string | null | undefined): void {
        const normalizedName = String(systemName || '').trim() || this.defaultSystemName;
        this.title.setTitle(normalizedName);
        this.setFavicon(systemLogoUrl);
    }

    private setFavicon(systemLogoUrl: string | null | undefined): void {
        const logoUrl = String(systemLogoUrl || '').trim();
        const faviconHref = logoUrl || this.defaultFaviconHref;
        if (!faviconHref) return;

        const favicon = this.getOrCreateFaviconElement();
        favicon.setAttribute('href', faviconHref);
    }

    private getOrCreateFaviconElement(): HTMLLinkElement {
        const existing = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
        if (existing) return existing;

        const link = document.createElement('link');
        link.setAttribute('rel', 'icon');
        document.head.appendChild(link);
        return link;
    }

    private getCurrentFaviconHref(): string {
        const favicon = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
        return favicon?.getAttribute('href') || '';
    }

    private isSelectableTextField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return false;
        }

        if (target.readOnly || target.disabled) {
            return false;
        }

        if (target instanceof HTMLInputElement) {
            const nonTextTypes = new Set([
                'button',
                'checkbox',
                'color',
                'date',
                'datetime-local',
                'file',
                'hidden',
                'image',
                'month',
                'radio',
                'range',
                'reset',
                'submit',
                'time',
                'week'
            ]);

            if (nonTextTypes.has(target.type)) {
                return false;
            }
        }

        return true;
    }
}
