import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'ok' | 'error' | 'warn';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  texto: string;
}

const DURACION_MS: Record<TipoNotificacion, number> = { ok: 5000, warn: 8000, error: 8000 };

// Notificaciones emergentes (abajo a la derecha) con un tono de alerta
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  readonly lista = signal<Notificacion[]>([]);

  private siguienteId = 1;
  private contexto: AudioContext | null = null;

  ok(texto: string): void {
    this.mostrar('ok', texto);
  }

  error(texto: string): void {
    this.mostrar('error', texto);
  }

  advertencia(texto: string): void {
    this.mostrar('warn', texto);
  }

  mostrar(tipo: TipoNotificacion, texto: string): void {
    const id = this.siguienteId++;
    this.lista.update((actual) => [...actual.slice(-4), { id, tipo, texto }]);
    this.sonar(tipo);
    setTimeout(() => this.cerrar(id), DURACION_MS[tipo]);
  }

  cerrar(id: number): void {
    this.lista.update((actual) => actual.filter((n) => n.id !== id));
  }

  duracion(tipo: TipoNotificacion): number {
    return DURACION_MS[tipo];
  }

  // Tonos generados con Web Audio: no se necesitan archivos de sonido
  private sonar(tipo: TipoNotificacion): void {
    const notas: Record<TipoNotificacion, number[]> = {
      error: [660, 440],
      warn: [587, 587],
      ok: [660, 880],
    };
    try {
      this.contexto ??= new AudioContext();
      const contexto = this.contexto;
      if (contexto.state === 'suspended') void contexto.resume();

      notas[tipo].forEach((frecuencia, i) => {
        const inicio = contexto.currentTime + i * 0.16;
        const oscilador = contexto.createOscillator();
        const volumen = contexto.createGain();
        oscilador.type = tipo === 'error' ? 'triangle' : 'sine';
        oscilador.frequency.value = frecuencia;
        volumen.gain.setValueAtTime(0.0001, inicio);
        volumen.gain.exponentialRampToValueAtTime(0.12, inicio + 0.02);
        volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.15);
        oscilador.connect(volumen).connect(contexto.destination);
        oscilador.start(inicio);
        oscilador.stop(inicio + 0.16);
      });
    } catch {
      // el navegador no permite reproducir audio todavía: la notificación sale sin sonido
    }
  }
}
