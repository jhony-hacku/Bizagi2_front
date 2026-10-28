import { Observable } from 'rxjs';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Diagrama, DiagramaLane, DiagramaPool, TipoParticipante } from '../../../core/models/diagrama.model';
import { RolProceso } from '../../../core/models/organizacion.model';
import { DiagramaService } from '../../../core/services/diagrama.service';
import { errorMessage } from '../../../core/utils/http-error';
import { Aviso, ETIQUETA_PARTICIPANTE, Seleccion, entradas } from './panel.types';
import { ConfirmacionService } from '../../../core/services/confirmacion.service';

type Formulario = 'pool' | 'lane';

// HU-21 (pools), HU-22 (lanes) y HU-24 (roles disponibles y permisos del pool)
@Component({
  selector: 'app-panel-estructura',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './panel-estructura.component.html',
})
export class PanelEstructuraComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DiagramaService);
  private readonly confirmacion = inject(ConfirmacionService);

  readonly diagrama = input.required<Diagrama>();
  readonly seleccion = input<Seleccion | null>(null);
  readonly puedeEditar = input(false);

  readonly cambio = output<void>();
  readonly aviso = output<Aviso>();

  protected readonly participantes = entradas<TipoParticipante>(ETIQUETA_PARTICIPANTE);
  protected readonly etiquetaParticipante = ETIQUETA_PARTICIPANTE;

  protected readonly formulario = signal<Formulario | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly poolDeLane = signal<number | null>(null);
  protected readonly roles = signal<RolProceso[]>([]);
  protected readonly destinoArrastre = signal<number | null>(null);
  private arrastrando: { poolId: number; indice: number } | null = null;
  protected readonly guardando = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly formPool = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    tipoParticipante: ['EMPRESA_PROPIETARIA' as TipoParticipante],
  });

  protected readonly formLane = this.fb.group({
    rolProcesoId: this.fb.control<number | null>(null, Validators.required),
    nombre: this.fb.nonNullable.control(''),
  });

  constructor() {
    effect(() => {
      const sel = this.seleccion();
      if (!sel || !this.puedeEditar()) return;
      untracked(() => {
        if (sel.tipo === 'pool') this.editarPool(sel.id);
        if (sel.tipo === 'lane') {
          const pool = this.diagrama().pools.find((p) => p.lanes.some((l) => l.id === sel.id));
          const lane = pool?.lanes.find((l) => l.id === sel.id);
          if (pool && lane) this.editarLane(pool, lane);
        }
      });
    });
  }

  // ---------- Pools ----------

  protected nuevoPool(): void {
    this.errorMessage.set(null);
    this.editandoId.set(null);
    this.formPool.reset({ nombre: '', tipoParticipante: 'CLIENTE' });
    this.formulario.set('pool');
  }

  protected editarPool(id: number): void {
    const pool = this.diagrama().pools.find((p) => p.id === id);
    if (!pool) return;
    this.errorMessage.set(null);
    this.formPool.reset({ nombre: pool.nombre, tipoParticipante: pool.tipoParticipante });
    this.editandoId.set(id);
    this.formulario.set('pool');
  }

  protected async eliminarPool(pool: DiagramaPool): Promise<void> {
    const aceptado = await this.confirmacion.pedir({
      titulo: 'Eliminar pool',
      mensaje: `¿Eliminar el pool "${pool.nombre}" con todo lo que contiene?`,
    });
    if (!aceptado) return;
    this.api.eliminarPool(pool.id).subscribe({
      next: () => {
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: 'Pool eliminado.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar el pool.') }),
    });
  }

  // ---------- Lanes ----------

  protected nuevaLane(pool: DiagramaPool): void {
    this.errorMessage.set(null);
    this.editandoId.set(null);
    this.poolDeLane.set(pool.id);
    this.formLane.reset({ rolProcesoId: null, nombre: '' });
    this.cargarRoles(pool.id);
    this.formulario.set('lane');
  }

  protected editarLane(pool: DiagramaPool, lane: DiagramaLane): void {
    this.errorMessage.set(null);
    this.poolDeLane.set(pool.id);
    this.formLane.reset({ rolProcesoId: lane.rolProcesoId ?? null, nombre: lane.nombre });
    this.cargarRoles(pool.id);
    this.editandoId.set(lane.id);
    this.formulario.set('lane');
  }

  protected async eliminarLane(lane: DiagramaLane): Promise<void> {
    const aceptado = await this.confirmacion.pedir({
      titulo: 'Eliminar lane',
      mensaje: `¿Eliminar la lane "${lane.nombre}"? Debe estar sin actividades.`,
    });
    if (!aceptado) return;
    this.api.eliminarLane(lane.id).subscribe({
      next: () => {
        this.cancelar();
        this.aviso.emit({ tipo: 'ok', texto: 'Lane eliminada.' });
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar la lane.') }),
    });
  }

  protected mover(pool: DiagramaPool, indice: number, delta: -1 | 1): void {
    const ids = pool.lanes.map((l) => l.id);
    const destino = indice + delta;
    if (destino < 0 || destino >= ids.length) return;
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    this.reordenar(pool, ids);
  }

  // Arrastrar una lane sobre otra del mismo pool para cambiar su orden
  protected iniciarArrastre(evento: DragEvent, pool: DiagramaPool, indice: number): void {
    this.arrastrando = { poolId: pool.id, indice };
    if (evento.dataTransfer) {
      evento.dataTransfer.setData('text/plain', pool.lanes[indice].nombre);
      evento.dataTransfer.effectAllowed = 'move';
    }
  }

  protected sobreLane(evento: DragEvent, pool: DiagramaPool, indice: number): void {
    if (this.arrastrando?.poolId !== pool.id) return;
    evento.preventDefault();
    this.destinoArrastre.set(indice);
  }

  protected soltarLane(evento: DragEvent, pool: DiagramaPool, destino: number): void {
    evento.preventDefault();
    const origen = this.arrastrando;
    this.finalizarArrastre();
    if (!origen || origen.poolId !== pool.id || origen.indice === destino) return;
    const ids = pool.lanes.map((l) => l.id);
    const [movida] = ids.splice(origen.indice, 1);
    ids.splice(destino, 0, movida);
    this.reordenar(pool, ids);
  }

  protected finalizarArrastre(): void {
    this.arrastrando = null;
    this.destinoArrastre.set(null);
  }

  private reordenar(pool: DiagramaPool, ids: number[]): void {
    this.api.reordenarLanes(pool.id, ids).subscribe({
      next: () => this.cambio.emit(),
      error: (err: HttpErrorResponse) =>
        this.aviso.emit({ tipo: 'error', texto: errorMessage(err, 'No se pudo reordenar las lanes.') }),
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
    const form = tipo === 'pool' ? this.formPool : this.formLane;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorMessage.set(null);
    const id = this.editandoId();

    let peticion: Observable<unknown>;
    if (tipo === 'pool') {
      const datos = this.formPool.getRawValue();
      datos.nombre = datos.nombre.trim();
      peticion = id
        ? this.api.actualizarPool(id, datos)
        : this.api.crearPool(this.diagrama().proceso.id, datos);
    } else {
      const v = this.formLane.getRawValue();
      const datos = { rolProcesoId: v.rolProcesoId, nombre: v.nombre.trim() || null };
      peticion = id ? this.api.actualizarLane(id, datos) : this.api.crearLane(this.poolDeLane()!, datos);
    }

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

  private cargarRoles(poolId: number): void {
    this.api.rolesDisponibles(poolId).subscribe({
      next: (roles) => this.roles.set(roles),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(errorMessage(err, 'No se pudieron cargar los roles disponibles.')),
    });
  }
}
