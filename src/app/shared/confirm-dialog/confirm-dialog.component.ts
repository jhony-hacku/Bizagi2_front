import { Component, ElementRef, HostListener, effect, inject } from '@angular/core';
import { ConfirmacionService } from '../../core/services/confirmacion.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly confirmacion = inject(ConfirmacionService);

  constructor() {
    // Al abrir el cuadro el foco va al botón Cancelar
    effect(() => {
      if (this.confirmacion.solicitud()) {
        setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-foco]')?.focus());
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected alPresionarTecla(evento: KeyboardEvent): void {
    if (!this.confirmacion.solicitud()) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.confirmacion.responder(false);
    } else if (evento.key === 'Tab') {
      // El foco se queda dentro del cuadro
      const botones = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('button'));
      if (botones.length === 0) return;
      const primero = botones[0];
      const ultimo = botones[botones.length - 1];
      const activo = document.activeElement;
      if (evento.shiftKey && activo === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }
  }
}
