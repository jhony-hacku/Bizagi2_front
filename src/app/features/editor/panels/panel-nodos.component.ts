import { Observable } from 'rxjs';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Diagrama,
  DiagramaPool,
  Eliminacion,
  TipoActividad,
  TipoEvento,
  TipoGateway,
} from '../../../core/models/diagrama.model';
import { DiagramaService } from '../../../core/services/diagrama.service';
import { errorMessage } from '../../../core/utils/http-error';
import { LANE_HEIGHT, siguienteX } from '../diagrama-bpmn';
import {
  Aviso,
  ETIQUETA_ACTIVIDAD,
  ETIQUETA_EVENTO,
  ETIQUETA_GATEWAY,
  Seleccion,
  entradas,
} from './panel.types';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';

type Formulario = 'actividad' | 'gateway' | 'evento';

// HU-08 a HU-10 (actividades), HU-14 a HU-16 (gateways), HU-25 y HU-27 (eventos)
@Component({
  selector: 'app-panel-nodos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './panel-nodos.component.html',
})
export class PanelNodosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DiagramaService);
  private readonly confirmacion = inject(ConfirmacionService);

  readonly diagrama = input.required<Diagrama>();
  readonly seleccion = input<Seleccion | null>(null);
  readonly puedeEditar = input(false);
  readonly puedeEliminar = input(false);

  readonly cambio = output<void>();
  readonly aviso = output<Aviso>();

  protected readonly tiposActividad = entradas<TipoActividad>(ETIQUETA_ACTIVIDAD);
  protected readonly tiposGateway = entradas<TipoGateway>(ETIQUETA_GATEWAY);
  protected readonly tiposEvento = entradas<TipoEvento>(ETIQUETA_EVENTO);

  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly poolsConProceso = computed(() =>
    this.diagrama().pools.filter((p) => p.tipoParticipante === 'EMPRESA_PROPIETARIA' || p.lanes.length > 0),
  );

  protected readonly formActividad = this.fb.group({
    poolId: this.fb.control<number | null>(null, Validators.required),
    laneId: this.fb.control<number | null>(null, Validators.required),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    tipo: this.fb.nonNullable.control<TipoActividad>('TAREA'),
    descripcion: this.fb.nonNullable.control(''),
  });

  protected readonly formGateway = this.fb.group({
    poolId: this.fb.control<number | null>(null, Validators.required),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    tipoGateway: this.fb.nonNullable.control<TipoGateway>('EXCLUSIVA'),
  });

  protected readonly formEvento = this.fb.group({
    poolId: this.fb.control<number | null>(null, Validators.required),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    tipoEvento: this.fb.nonNullable.control<TipoEvento>('INICIO'),
    contenido: this.fb.nonNullable.control(''),
    claveCorrelacion: this.fb.nonNullable.control(''),
    origenExterno: this.fb.nonNullable.control(false),
  });

  protected readonly usuarias = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      const sel = this.seleccion();
      if (!sel || !this.puedeEditar()) return;
      untracked(() => {
        if (sel.tipo === 'actividad' || sel.tipo === 'gateway' || sel.tipo === 'evento') {
          this.editar(sel.tipo, sel.id);
        }
      });
    });

    this.formActividad.controls.poolId.valueChanges.subscribe((poolId) => {
      const pool = this.diagrama().pools.find((p) => p.id === poolId);
      const actual = this.formActividad.controls.laneId.value;
      if (pool && !pool.lanes.some((l) => l.id === actual)) {
        this.formActividad.controls.laneId.setValue(pool.lanes[0]?.id ?? null);
      }
    });
  }

  protected lanesDe(poolId: number | null) {
    return this.diagrama().pools.find((p) => p.id === poolId)?.lanes ?? [];
  }

  protected actividadesDe(poolId: number | null) {
    return this.diagrama().pools.find((p) => p.id === poolId)?.actividades ?? [];
  }

  protected esMensaje(tipo: TipoEvento): boolean {
    return tipo !== 'INICIO' && tipo !== 'FIN';
  }

  protected esRecepcion(tipo: TipoEvento): boolean {
    return tipo === 'MENSAJE_RECEPCION_INICIO' || tipo === 'MENSAJE_RECEPCION_INTERMEDIO';
  }

  protected etiquetaActividad(tipo: TipoActividad): string {
    return ETIQUETA_ACTIVIDAD[tipo];
  }

  protected etiquetaGateway(tipo: TipoGateway): string {
    return ETIQUETA_GATEWAY[tipo];
  }

  protected etiquetaEvento(tipo: TipoEvento): string {
    return ETIQUETA_EVENTO[tipo];
  }

  protected nombreLane(pool: DiagramaPool, laneId: number): string {
    return pool.lanes.find((l) => l.id === laneId)?.nombre ?? '';
  }

  protected alternarUsuaria(id: number, marcada: boolean): void {
    const copia = new Set(this.usuarias());
    if (marcada) copia.add(id);
    else copia.delete(id);
    this.usuarias.set(copia);
  }

  protected nuevo(tipo: Formulario): void {
    this.errorMessage.set(null);
    this.editandoId.set(null);
    const primerPool = this.poolsConProceso()[0];
    const poolId = primerPool?.id ?? null;
    if (tipo === 'actividad') {
      this.formActividad.reset({
        poolId,
        laneId: primerPool?.lanes[0]?.id ?? null,
        nombre: '',
        tipo: 'TAREA',
        descripcion: '',
      });
    } else if (tipo === 'gateway') {
      this.formGateway.reset({ poolId, nombre: '', tipoGateway: 'EXCLUSIVA' });
    } else {
      this.formEvento.reset({
        poolId,
        nombre: '',
        tipoEvento: 'INICIO',
        contenido: '',
        claveCorrelacion: '',
        origenExterno: false,
      });
      this.usuarias.set(new Set());
    }
    this.formulario.set(tipo);
  }

  protected editar(tipo: Formulario, id: number): void {
    this.errorMessage.set(null);
    for (const pool of this.diagrama().pools) {
      if (tipo === 'actividad') {
        const a = pool.actividades.find((x) => x.id === id);
        if (a) {
          this.formActividad.reset({
            poolId: pool.id,
            laneId: a.laneId,
            nombre: a.nombre,
            tipo: a.tipo,
            descripcion: a.descripcion ?? '',
          });
          return this.abrir(tipo, id);
        }
      } else if (tipo === 'gateway') {
        const g = pool.gateways.find((x) => x.id === id);
        if (g) {
          this.formGateway.reset({ poolId: pool.id, nombre: g.nombre, tipoGateway: g.tipoGateway });
          return this.abrir(tipo, id);
        }
      } else {
        const e = pool.eventos.find((x) => x.id === id);
        if (e) {
          this.formEvento.reset({
            poolId: pool.id,
            nombre: e.nombre,
            tipoEvento: e.tipoEvento,
            contenido: e.contenido ?? '',
            claveCorrelacion: e.claveCorrelacion ?? '',
            origenExterno: e.origenExterno ?? false,
          });
          this.usuarias.set(new Set(e.actividadesUsuarias ?? []));
          return this.abrir(tipo, id);
        }
      }
    }
  }

  protected cancelar(): void {
    this.formulario.set(null);
    this.editandoId.set(null);
    this.errorMessage.set(null);
  }

  protected guardar(): void {
    const tipo = this.formulario();
    if (!tipo || this.guardando()) return;
    const form = tipo === 'actividad' ? this.formActividad : tipo === 'gateway' ? this.formGateway : this.formEvento;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorMessage.set(null);

    const id = this.editandoId();
    let peticion: Observable<unknown>;
    if (tipo === 'actividad') {
      peticion = this.guardarActividad(id);
    } else if (tipo === 'gateway') {
      peticion = this.guardarGateway(id);
    } else {
      peticion = this.guardarEvento(id);
    }

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: id ? 'Elemento actualizado.' : 'Elemento creado.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo guardar el elemento.'));
      },
    });
  }

  protected async eliminar(tipo: Formulario, id: number, nombre: string): Promise<void> {
    const que = tipo === 'actividad' ? 'la actividad' : tipo === 'gateway' ? 'el gateway' : 'el evento';
    const aceptado = await this.confirmacion.pedir({
      titulo: `Eliminar ${tipo}`,
      mensaje: `¿Eliminar ${que} "${nombre}"? También se eliminan los arcos conectados.`,
    });
    if (!aceptado) {
      return;
    }
    const peticion =
      tipo === 'actividad'
        ? this.api.eliminarActividad(id)
        : tipo === 'gateway'
          ? this.api.eliminarGateway(id)
          : this.api.eliminarEvento(id);
    peticion.subscribe({
      next: (resultado: Eliminacion) => {
        this.cancelar();
        this.aviso.emit(resumenEliminacion(resultado));
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar el elemento.') }),
    });
  }

  private abrir(tipo: Formulario, id: number): void {
    this.editandoId.set(id);
    this.formulario.set(tipo);
  }

  private guardarActividad(id: number | null) {
    const v = this.formActividad.getRawValue();
    const pool = this.diagrama().pools.find((p) => p.id === v.poolId)!;
    if (id) {
      const actual = pool.actividades.find((a) => a.id === id) ?? this.buscarActividad(id);
      return this.api.actualizarActividad(id, {
        nombre: v.nombre.trim(),
        tipo: v.tipo,
        descripcion: v.descripcion,
        laneId: v.laneId,
        posicionX: actual?.posicionX ?? 0,
        posicionY: actual?.posicionY ?? 0,
      });
    }
    return this.api.crearActividad(v.laneId!, {
      nombre: v.nombre.trim(),
      tipo: v.tipo,
      descripcion: v.descripcion,
      posicionX: siguienteX(pool),
      posicionY: (LANE_HEIGHT - 80) / 2,
    });
  }

  private guardarGateway(id: number | null) {
    const v = this.formGateway.getRawValue();
    const pool = this.diagrama().pools.find((p) => p.id === v.poolId)!;
    if (id) {
      const actual = pool.gateways.find((g) => g.id === id);
      return this.api.actualizarGateway(id, {
        nombre: v.nombre.trim(),
        tipoGateway: v.tipoGateway,
        posicionX: actual?.posicionX ?? 0,
        posicionY: actual?.posicionY ?? 0,
      });
    }
    return this.api.crearGateway(pool.id, {
      nombre: v.nombre.trim(),
      tipoGateway: v.tipoGateway,
      posicionX: siguienteX(pool),
      posicionY: (LANE_HEIGHT - 50) / 2,
    });
  }

  private guardarEvento(id: number | null) {
    const v = this.formEvento.getRawValue();
    const pool = this.diagrama().pools.find((p) => p.id === v.poolId)!;
    const mensaje = this.esMensaje(v.tipoEvento);
    const recepcion = this.esRecepcion(v.tipoEvento);
    const base = {
      nombre: v.nombre.trim(),
      tipoEvento: v.tipoEvento,
      contenido: mensaje ? v.contenido : null,
      claveCorrelacion: mensaje ? v.claveCorrelacion : null,
      origenExterno: recepcion ? v.origenExterno : null,
      actividadesUsuarias: recepcion ? [...this.usuarias()] : null,
    };
    if (id) {
      const actual = pool.eventos.find((e) => e.id === id);
      return this.api.actualizarEvento(id, {
        ...base,
        posicionX: actual?.posicionX ?? 0,
        posicionY: actual?.posicionY ?? 0,
      });
    }
    return this.api.crearEvento(pool.id, {
      ...base,
      posicionX: siguienteX(pool),
      posicionY: (LANE_HEIGHT - 36) / 2,
    });
  }

  private buscarActividad(id: number) {
    for (const pool of this.diagrama().pools) {
      const a = pool.actividades.find((x) => x.id === id);
      if (a) return a;
    }
    return undefined;
  }
}

export function resumenEliminacion(r: Eliminacion): Aviso {
  const partes = ['Elemento eliminado.'];
  if (r.arcosEliminados) partes.push(`Arcos eliminados: ${r.arcosEliminados}.`);
  if (r.mensajesEliminados) partes.push(`Mensajes eliminados: ${r.mensajesEliminados}.`);
  const advertencias = r.advertencias?.map((a) => a.mensaje) ?? [];
  if (advertencias.length) partes.push(`Atención: ${advertencias.join(' ')}`);
  return { tipo: advertencias.length ? 'warn' : 'ok', texto: partes.join(' ') };
}
