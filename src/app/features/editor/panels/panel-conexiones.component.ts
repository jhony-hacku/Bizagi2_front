import { Observable } from 'rxjs';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AccionFallo,
  AccionSinCaso,
  Diagrama,
  DiagramaMensaje,
  TipoDestino,
} from '../../../core/models/diagrama.model';
import { DiagramaService } from '../../../core/services/diagrama.service';
import { errorMessage } from '../../../core/utils/http-error';
import { resumenEliminacion } from './panel-nodos.component';
import { Aviso, ETIQUETA_DESTINO, ETIQUETA_PARTICIPANTE, Seleccion, entradas } from './panel.types';

interface OpcionNodo {
  id: number;
  nombre: string;
  etiqueta: string;
  gatewayCondicional: boolean;
}

type Formulario = 'arco' | 'mensaje' | 'correlacion';

const ETIQUETA_FALLO: Record<AccionFallo, string> = {
  CONTINUAR_FLUJO: 'Continuar el flujo',
  DERIVAR_A_MANEJO_ERROR: 'Derivar a una actividad de manejo de error',
  FINALIZAR_PROCESO: 'Finalizar el proceso',
};

const ETIQUETA_SIN_CASO: Record<AccionSinCaso, string> = {
  DESCARTAR: 'Descartar el mensaje',
  INICIAR_CASO_NUEVO: 'Iniciar un caso nuevo',
};

// HU-11 a HU-13 (arcos), HU-25 y HU-26 (mensajes), HU-28 (correlación)
@Component({
  selector: 'app-panel-conexiones',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './panel-conexiones.component.html',
})
export class PanelConexionesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DiagramaService);

  readonly diagrama = input.required<Diagrama>();
  readonly seleccion = input<Seleccion | null>(null);
  readonly puedeEditar = input(false);
  readonly puedeEliminar = input(false);

  readonly cambio = output<void>();
  readonly aviso = output<Aviso>();

  protected readonly destinos = entradas<TipoDestino>(ETIQUETA_DESTINO);
  protected readonly fallos = entradas<AccionFallo>(ETIQUETA_FALLO);
  protected readonly sinCaso = entradas<AccionSinCaso>(ETIQUETA_SIN_CASO);

  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly formArco = this.fb.group({
    poolId: this.fb.control<number | null>(null, Validators.required),
    origenId: this.fb.control<number | null>(null, Validators.required),
    destinoId: this.fb.control<number | null>(null, Validators.required),
    etiqueta: this.fb.nonNullable.control(''),
    condicion: this.fb.nonNullable.control(''),
  });

  protected readonly formMensaje = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    origenId: this.fb.control<number | null>(null, Validators.required),
    destinoPoolId: this.fb.control<number | null>(null, Validators.required),
    contenido: this.fb.nonNullable.control(''),
    tipoDestino: this.fb.control<TipoDestino | null>(null),
    momento: this.fb.nonNullable.control(''),
    accionFallo: this.fb.control<AccionFallo | null>(null),
    actividadErrorId: this.fb.control<number | null>(null),
  });

  protected readonly formCorrelacion = this.fb.nonNullable.group({
    criterio: ['', Validators.required],
    accionSinCaso: ['DESCARTAR' as AccionSinCaso],
  });

  private readonly poolArcoId = signal<number | null>(null);
  private readonly poolDestinoId = signal<number | null>(null);
  private readonly origenArcoId = signal<number | null>(null);
  private readonly origenMensajeId = signal<number | null>(null);
  private readonly falloSel = signal<AccionFallo | null>(null);

  protected readonly poolsConNodos = computed(() =>
    this.diagrama().pools.filter((p) => p.actividades.length + p.gateways.length + p.eventos.length > 0),
  );

  protected readonly nodosDelPool = computed<OpcionNodo[]>(() => {
    const pool = this.diagrama().pools.find((p) => p.id === this.poolArcoId());
    if (!pool) return [];
    return [
      ...pool.actividades.map((a) => ({ id: a.id, nombre: a.nombre, etiqueta: 'Actividad', gatewayCondicional: false })),
      ...pool.gateways.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        etiqueta: 'Gateway',
        gatewayCondicional: g.tipoGateway !== 'PARALELA',
      })),
      ...pool.eventos.map((e) => ({ id: e.id, nombre: e.nombre, etiqueta: 'Evento', gatewayCondicional: false })),
    ];
  });

  protected readonly pedirCondicion = computed(
    () => this.nodosDelPool().find((n) => n.id === this.origenArcoId())?.gatewayCondicional ?? false,
  );

  protected readonly origenesMensaje = computed(() => {
    const resultado: { id: number; nombre: string; poolId: number; etiqueta: string }[] = [];
    for (const pool of this.diagrama().pools) {
      for (const e of pool.eventos) {
        if (e.tipoEvento === 'MENSAJE_LANZAMIENTO') {
          resultado.push({ id: e.id, nombre: e.nombre, poolId: pool.id, etiqueta: 'Evento de lanzamiento' });
        }
      }
      for (const a of pool.actividades) {
        if (a.tipo === 'ENVIO') {
          resultado.push({ id: a.id, nombre: a.nombre, poolId: pool.id, etiqueta: 'Actividad de envío' });
        }
      }
    }
    return resultado;
  });

  protected readonly poolsDestino = computed(() => {
    const origen = this.origenesMensaje().find((o) => o.id === this.origenMensajeId());
    return this.diagrama().pools.filter((p) => p.id !== origen?.poolId);
  });

  protected readonly destinoExterno = computed(
    () => this.diagrama().pools.find((p) => p.id === this.poolDestinoId())?.tipoParticipante === 'SISTEMA_EXTERNO',
  );

  protected readonly derivaAError = computed(() => this.falloSel() === 'DERIVAR_A_MANEJO_ERROR');

  protected readonly actividadesProceso = computed(() =>
    this.diagrama().pools.flatMap((p) => p.actividades.map((a) => ({ id: a.id, nombre: a.nombre }))),
  );

  protected readonly arcos = computed(() =>
    this.diagrama().pools.flatMap((pool) => {
      const nombre = (id: number) =>
        pool.actividades.find((a) => a.id === id)?.nombre ??
        pool.gateways.find((g) => g.id === id)?.nombre ??
        pool.eventos.find((e) => e.id === id)?.nombre ??
        `#${id}`;
      return pool.arcos.map((a) => ({
        ...a,
        poolId: pool.id,
        poolNombre: pool.nombre,
        origenNombre: nombre(a.origenId),
        destinoNombre: nombre(a.destinoId),
      }));
    }),
  );

  protected readonly mensajes = computed(() => {
    const d = this.diagrama();
    const poolNombre = (id: number) => d.pools.find((p) => p.id === id)?.nombre ?? `#${id}`;
    const origenNombre = (id: number) => this.origenesMensaje().find((o) => o.id === id)?.nombre ?? `#${id}`;
    return d.mensajes.map((m) => ({
      ...m,
      origenNombre: origenNombre(m.origenId),
      destinoNombre: poolNombre(m.destinoPoolId),
      origenPoolNombre: poolNombre(m.origenPoolId),
    }));
  });

  constructor() {
    effect(() => {
      const sel = this.seleccion();
      if (!sel || !this.puedeEditar()) return;
      untracked(() => {
        if (sel.tipo === 'arco') this.editarArco(sel.id);
        if (sel.tipo === 'mensaje') this.editarMensaje(sel.id);
      });
    });

    this.formArco.controls.poolId.valueChanges.subscribe((v) => {
      this.poolArcoId.set(v);
      const ids = new Set(this.nodosDelPool().map((n) => n.id));
      for (const control of [this.formArco.controls.origenId, this.formArco.controls.destinoId]) {
        if (control.value !== null && !ids.has(control.value)) control.setValue(null);
      }
    });
    this.formArco.controls.origenId.valueChanges.subscribe((v) => this.origenArcoId.set(v));
    this.formMensaje.controls.origenId.valueChanges.subscribe((v) => this.origenMensajeId.set(v));
    this.formMensaje.controls.destinoPoolId.valueChanges.subscribe((v) => this.poolDestinoId.set(v));
    this.formMensaje.controls.accionFallo.valueChanges.subscribe((v) => this.falloSel.set(v));
  }

  protected etiquetaDestino(tipo: TipoDestino | null): string {
    return tipo ? ETIQUETA_DESTINO[tipo] : '';
  }

  protected etiquetaParticipante(poolId: number): string {
    const pool = this.diagrama().pools.find((p) => p.id === poolId);
    return pool ? ETIQUETA_PARTICIPANTE[pool.tipoParticipante] : '';
  }

  // ---------- Arcos ----------

  protected nuevoArco(): void {
    this.errorMessage.set(null);
    this.editandoId.set(null);
    const pool = this.poolsConNodos()[0];
    this.formArco.reset({ poolId: pool?.id ?? null, origenId: null, destinoId: null, etiqueta: '', condicion: '' });
    this.sincronizarArco();
    this.formulario.set('arco');
  }

  protected editarArco(id: number): void {
    const arco = this.arcos().find((a) => a.id === id);
    if (!arco) return;
    this.errorMessage.set(null);
    this.formArco.reset({
      poolId: arco.poolId,
      origenId: arco.origenId,
      destinoId: arco.destinoId,
      etiqueta: arco.etiqueta ?? '',
      condicion: arco.condicion ?? '',
    });
    this.sincronizarArco();
    this.editandoId.set(id);
    this.formulario.set('arco');
  }

  protected eliminarArco(id: number, descripcion: string): void {
    if (!confirm(`¿Eliminar el arco ${descripcion}?`)) return;
    this.api.eliminarArco(id).subscribe({
      next: (r) => {
        this.cancelar();
        this.aviso.emit(resumenEliminacion(r));
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar el arco.') }),
    });
  }

  // ---------- Mensajes ----------

  protected nuevoMensaje(): void {
    this.errorMessage.set(null);
    this.editandoId.set(null);
    this.formMensaje.reset({
      nombre: '',
      origenId: this.origenesMensaje()[0]?.id ?? null,
      destinoPoolId: null,
      contenido: '',
      tipoDestino: null,
      momento: '',
      accionFallo: null,
      actividadErrorId: null,
    });
    this.sincronizarMensaje();
    this.formulario.set('mensaje');
  }

  protected editarMensaje(id: number): void {
    const m = this.diagrama().mensajes.find((x) => x.id === id);
    if (!m) return;
    this.errorMessage.set(null);
    this.formMensaje.reset({
      nombre: m.nombre,
      origenId: m.origenId,
      destinoPoolId: m.destinoPoolId,
      contenido: m.contenido ?? '',
      tipoDestino: m.tipoDestino,
      momento: m.momento ?? '',
      accionFallo: m.accionFallo,
      actividadErrorId: m.actividadErrorId,
    });
    this.sincronizarMensaje();
    this.editandoId.set(id);
    this.formulario.set('mensaje');
  }

  protected eliminarMensaje(m: DiagramaMensaje): void {
    if (!confirm(`¿Eliminar el mensaje "${m.nombre}"?`)) return;
    this.api.eliminarMensaje(m.id).subscribe({
      next: () => {
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: 'Mensaje eliminado.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar el mensaje.') }),
    });
  }

  // ---------- Correlación ----------

  protected editarCorrelacion(m: DiagramaMensaje): void {
    this.errorMessage.set(null);
    this.formCorrelacion.reset({
      criterio: m.correlacion?.criterio ?? '',
      accionSinCaso: m.correlacion?.accionSinCaso ?? 'DESCARTAR',
    });
    this.editandoId.set(m.id);
    this.formulario.set('correlacion');
  }

  protected quitarCorrelacion(m: DiagramaMensaje): void {
    if (!confirm(`¿Quitar la correlación del mensaje "${m.nombre}"?`)) return;
    this.api.eliminarCorrelacion(m.id).subscribe({
      next: () => {
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: 'Correlación eliminada.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo quitar la correlación.') }),
    });
  }

  // ---------- Común ----------

  protected cancelar(): void {
    this.formulario.set(null);
    this.editandoId.set(null);
    this.errorMessage.set(null);
  }

  protected guardar(): void {
    const tipo = this.formulario();
    if (!tipo || this.guardando()) return;
    const form = tipo === 'arco' ? this.formArco : tipo === 'mensaje' ? this.formMensaje : this.formCorrelacion;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const id = this.editandoId();
    this.guardando.set(true);
    this.errorMessage.set(null);

    const peticion: Observable<unknown> =
      tipo === 'arco' ? this.guardarArco(id) : tipo === 'mensaje' ? this.guardarMensaje(id) : this.guardarCorrelacion(id!);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: 'Cambios guardados.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudieron guardar los cambios.'));
      },
    });
  }

  private guardarArco(id: number | null) {
    const v = this.formArco.getRawValue();
    const datos = {
      origenId: v.origenId!,
      destinoId: v.destinoId!,
      etiqueta: v.etiqueta.trim() || null,
      condicion: this.pedirCondicion() ? v.condicion.trim() || null : null,
    };
    return id ? this.api.actualizarArco(id, datos) : this.api.crearArco(v.poolId!, datos);
  }

  private guardarMensaje(id: number | null) {
    const v = this.formMensaje.getRawValue();
    const externo = this.destinoExterno();
    const datos = {
      nombre: v.nombre.trim(),
      origenId: v.origenId!,
      destinoPoolId: v.destinoPoolId!,
      contenido: v.contenido,
      tipoDestino: externo ? v.tipoDestino : null,
      momento: externo ? v.momento : null,
      accionFallo: externo ? v.accionFallo : null,
      actividadErrorId: externo && v.accionFallo === 'DERIVAR_A_MANEJO_ERROR' ? v.actividadErrorId : null,
    };
    return id ? this.api.actualizarMensaje(id, datos) : this.api.crearMensaje(this.diagrama().proceso.id, datos);
  }

  private guardarCorrelacion(mensajeId: number) {
    const datos = this.formCorrelacion.getRawValue();
    const existe = this.diagrama().mensajes.find((m) => m.id === mensajeId)?.correlacion;
    return existe
      ? this.api.actualizarCorrelacion(mensajeId, datos)
      : this.api.crearCorrelacion(mensajeId, datos);
  }

  private sincronizarArco(): void {
    const v = this.formArco.getRawValue();
    this.poolArcoId.set(v.poolId);
    this.origenArcoId.set(v.origenId);
  }

  private sincronizarMensaje(): void {
    const v = this.formMensaje.getRawValue();
    this.origenMensajeId.set(v.origenId);
    this.poolDestinoId.set(v.destinoPoolId);
    this.falloSel.set(v.accionFallo);
  }
}
