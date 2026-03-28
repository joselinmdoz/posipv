import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit, OnDestroy {
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
    }

    ngOnDestroy(): void {
        document.removeEventListener('focusin', this.onFocusIn, true);
        document.removeEventListener('pointerup', this.onPointerUp, true);
    }

    private scheduleSelect(target: EventTarget | null): void {
        if (!this.isSelectableTextField(target)) return;
        setTimeout(() => target.select(), 0);
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
