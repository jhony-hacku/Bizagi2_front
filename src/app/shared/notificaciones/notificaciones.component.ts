import { Component, inject, signal } from '@angular/core';
import { NotificacionService } from '../../core/services/notificacion.service';

const UMBRAL_DESCARTE_PX = 90;
const DURACION_SALIDA_MS = 200;

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
})
export class NotificacionesComponent {
  protected readonly servicio = inject(NotificacionService);

  // Desplazamiento horizontal de la notificación que se está arrastrando
  protected readonly desplazamientos = signal<Record<number, number>>({});
  protected readonly saliendo = signal<ReadonlySet<number>>(new Set());
  protected readonly arrastrando = signal<number | null>(null);

  private origenX = 0;

  protected iniciar(evento: PointerEvent, id: number): void {
    if ((evento.target as HTMLElement).closest('button')) return;
    this.origenX = evento.clientX;
    this.arrastrando.set(id);
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
  }

  protected mover(evento: PointerEvent, id: number): void {
    if (this.arrastrando() !== id) return;
    const dx = Math.max(0, evento.clientX - this.origenX);
    this.desplazamientos.update((d) => ({ ...d, [id]: dx }));
  }

  protected soltar(evento: PointerEvent, id: number): void {
    if (this.arrastrando() !== id) return;
    this.arrastrando.set(null);
    (evento.currentTarget as HTMLElement).releasePointerCapture(evento.pointerId);
    if ((this.desplazamientos()[id] ?? 0) >= UMBRAL_DESCARTE_PX) {
      this.descartar(id);
    } else {
      this.desplazamientos.update((d) => ({ ...d, [id]: 0 }));
    }
  }

  protected descartar(id: number): void {
    this.saliendo.update((s) => new Set(s).add(id));
    setTimeout(() => {
      this.servicio.cerrar(id);
      this.saliendo.update((s) => {
        const copia = new Set(s);
        copia.delete(id);
        return copia;
      });
      this.desplazamientos.update(({ [id]: _, ...resto }) => resto);
    }, DURACION_SALIDA_MS);
  }
}
