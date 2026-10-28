import { Injectable, signal } from '@angular/core';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  // Texto del botón que confirma (por defecto "Eliminar")
  etiqueta?: string;
}

export interface SolicitudConfirmacion extends Required<OpcionesConfirmacion> {
  resolver: (aceptado: boolean) => void;
}

// Cuadro de confirmación centrado, usado en lugar de window.confirm
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  readonly solicitud = signal<SolicitudConfirmacion | null>(null);

  pedir(opciones: OpcionesConfirmacion): Promise<boolean> {
    // Si ya había una pregunta abierta se cancela antes de mostrar la nueva
    this.solicitud()?.resolver(false);
    return new Promise<boolean>((resolver) => {
      this.solicitud.set({ etiqueta: 'Eliminar', ...opciones, resolver });
    });
  }

  responder(aceptado: boolean): void {
    const actual = this.solicitud();
    if (!actual) return;
    this.solicitud.set(null);
    actual.resolver(aceptado);
  }
}
