import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { AuthService } from '../../core/services/auth.service';
import { DiagramaService } from '../../core/services/diagrama.service';
import { EmpresaService } from '../../core/services/organizacion.service';
import { Advertencia, Diagrama, Eliminacion } from '../../core/models/diagrama.model';
import { Empresa } from '../../core/models/organizacion.model';
import { errorMessage } from '../../core/utils/http-error';
import {
  CONTENT_X,
  EVENT_SIZE,
  GATEWAY_SIZE,
  LANE_HEIGHT,
  Layout,
  TASK_SIZE,
  construirBpmn,
} from './diagrama-bpmn';
import { ItemPaleta, PALETA, TIPO_MIME_PALETA, nombreLibre } from './paleta';
import { PanelConexionesComponent } from './panels/panel-conexiones.component';
import { PanelEstructuraComponent } from './panels/panel-estructura.component';
import { PanelNodosComponent, resumenEliminacion } from './panels/panel-nodos.component';
import { Aviso, Seleccion, TipoSeleccion } from './panels/panel.types';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { PerfilMenuComponent } from '../../shared/perfil-menu/perfil-menu.component';

type Pestana = 'nodos' | 'conexiones' | 'estructura' | 'validacion';

const NODO = /^(Actividad|Gateway|Evento)_\d+$/;

const ELIMINABLES: TipoSeleccion[] = ['actividad', 'gateway', 'evento', 'arco', 'mensaje'];

const MENU_ANCHO = 200;
const MENU_ALTO = 110;

const PATRONES: [RegExp, TipoSeleccion][] = [
  [/^Actividad_(\d+)$/, 'actividad'],
  [/^Gateway_(\d+)$/, 'gateway'],
  [/^Evento_(\d+)$/, 'evento'],
  [/^Arco_(\d+)$/, 'arco'],
  [/^Mensaje_(\d+)$/, 'mensaje'],
  [/^Pool_(\d+)$/, 'pool'],
  [/^Lane_(\d+)$/, 'lane'],
];

const PESTANA_DE: Record<TipoSeleccion, Pestana> = {
  actividad: 'nodos',
  gateway: 'nodos',
  evento: 'nodos',
  arco: 'conexiones',
  mensaje: 'conexiones',
  pool: 'estructura',
  lane: 'estructura',
};

const PREFIJO_ELEMENTO: Record<string, string> = {
  ACTIVIDAD: 'Actividad',
  GATEWAY: 'Gateway',
  EVENTO: 'Evento',
  ARCO: 'Arco',
  MENSAJE: 'Mensaje',
};

// Acciones del modelador que se bloquean: el diagrama se edita desde el panel lateral
const ACCIONES_BLOQUEADAS = [
  'shape.resize',
  'shape.delete',
  'elements.delete',
  'connection.reconnect',
  'connection.delete',
  'shape.create',
  'elements.create',
  'lane.add',
  'lane.split',
  'shape.replace',
  'element.updateLabel',
];

// Editor BPMN (bpmn-js) sobre el diagrama del proceso
@Component({
  selector: 'app-bpmn-editor',
  standalone: true,
  imports: [PanelNodosComponent, PanelConexionesComponent, PanelEstructuraComponent, PerfilMenuComponent],
  templateUrl: './bpmn-editor.component.html',
  styleUrl: './bpmn-editor.component.css',
})
export class BpmnEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly diagramaService = inject(DiagramaService);
  private readonly empresaService = inject(EmpresaService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly notificaciones = inject(NotificacionService);

  readonly id = input.required<string>();

  protected readonly diagrama = signal<Diagrama | null>(null);
  protected readonly advertencias = signal<Advertencia[]>([]);
  protected readonly seleccion = signal<Seleccion | null>(null);
  protected readonly pestana = signal<Pestana>('nodos');
  protected readonly cargando = signal(true);
  protected readonly modoConectar = signal(false);
  protected readonly menu = signal<{ x: number; y: number; sel: Seleccion; descripcion: string } | null>(null);
  protected readonly paleta = PALETA;
  private readonly empresa = signal<Empresa | null>(null);

  protected readonly errores = computed(() => this.advertencias().filter((a) => a.nivel === 'ERROR').length);

  protected readonly puedeEditar = computed(
    () => this.authService.puedeEscribir() && !!this.diagrama()?.proceso.propio && !!this.diagrama()?.proceso.activo,
  );
  protected readonly puedeEliminar = computed(
    () => this.authService.esAdministrador() && !!this.diagrama()?.proceso.propio && !!this.diagrama()?.proceso.activo,
  );
  protected readonly puedeEstructura = computed(
    () =>
      this.puedeEditar() &&
      (this.authService.esAdministrador() || this.empresa()?.editorModificaEstructura !== false),
  );

  private modeler: any;
  private layout: Layout = { pools: [] };
  private destruido = false;

  ngAfterViewInit(): void {
    const permitir = () => this.puedeEditar();
    const conectando = () => this.modoConectar();
    const alConectar = (origen: any, destino: any) => this.alConectar(origen, destino);
    const esNodo = (el: any) => NODO.test(el?.id ?? '');
    const poolDe = (el: any) => {
      let actual = el;
      while (actual && actual.type !== 'bpmn:Participant') actual = actual.parent;
      return actual;
    };

    // Solo se permite mover nodos y conectarlos dentro de un pool; el resto se edita desde el panel
    function ControlDeEdicion(eventBus: any) {
      for (const accion of ACCIONES_BLOQUEADAS) {
        eventBus.on(`commandStack.${accion}.canExecute`, 10000, () => false);
      }
      eventBus.on('commandStack.elements.move.canExecute', 10000, (evento: any) => {
        if (!permitir() || conectando()) return false;
        const formas: any[] = evento.context.shapes ?? [];
        return formas.every(esNodo) ? undefined : false;
      });
      eventBus.on('commandStack.connection.create.canExecute', 10000, (evento: any) => {
        const { source, target } = evento.context;
        if (!permitir() || !conectando() || !esNodo(source) || !esNodo(target)) return false;
        return source.id !== target.id && poolDe(source) === poolDe(target);
      });
      // El arco se crea en el backend; bpmn-js no agrega la conexión por su cuenta
      eventBus.on('connect.end', 2000, (evento: any) => {
        const { canExecute, source, target } = evento.context;
        if (canExecute && source && target) alConectar(source, target);
        return false;
      });
      eventBus.on('element.dblclick', 10000, () => false);
    }
    ControlDeEdicion.$inject = ['eventBus'];

    this.modeler = new BpmnModeler({
      container: this.canvasRef.nativeElement,
      additionalModules: [{ __init__: ['controlDeEdicion'], controlDeEdicion: ['type', ControlDeEdicion] }],
    });

    this.modeler.on('selection.changed', (evento: any) => this.alSeleccionar(evento.newSelection?.[0]));
    this.modeler.on('commandStack.elements.move.postExecuted', (evento: any) =>
      this.alMover(evento.context.shapes ?? []),
    );
    this.modeler.on('element.contextmenu', 1500, (evento: any) => this.abrirMenu(evento));
    // En modo conectar, arrastrar desde un nodo dibuja un arco en lugar de mover el nodo
    this.modeler.on('element.mousedown', 1500, (evento: any) => {
      if (evento.originalEvent?.button) return;
      if (!this.modoConectar() || !this.puedeEditar() || !NODO.test(evento.element?.id ?? '')) return;
      this.modeler.get('connect').start(evento.originalEvent, evento.element, true);
      return false;
    });

    this.empresaService.obtener().subscribe({
      next: (empresa) => this.empresa.set(empresa),
      error: () => this.empresa.set(null),
    });
    this.cargar(true);
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.modeler?.destroy();
  }

  protected mostrarAviso(aviso: Aviso): void {
    this.notificaciones.mostrar(aviso.tipo, aviso.texto);
  }

  protected recargar(): void {
    this.cargar(false);
  }

  // Menú de clic derecho sobre un elemento del diagrama
  private abrirMenu(evento: any): void {
    const original: MouseEvent | undefined = evento.originalEvent;
    original?.preventDefault();

    const diagrama = this.diagrama();
    const sel = this.seleccionDe(evento.element?.id);
    const descripcion = sel && diagrama ? this.describir(sel, diagrama) : null;
    if (!original || !sel || !descripcion || !ELIMINABLES.includes(sel.tipo) || !this.puedeEditar()) {
      this.menu.set(null);
      return;
    }
    this.menu.set({
      x: Math.max(0, Math.min(original.clientX, window.innerWidth - MENU_ANCHO)),
      y: Math.max(0, Math.min(original.clientY, window.innerHeight - MENU_ALTO)),
      sel,
      descripcion,
    });
  }

  protected editarDesdeMenu(): void {
    const abierto = this.menu();
    if (!abierto) return;
    this.pestana.set(PESTANA_DE[abierto.sel.tipo]);
    this.seleccion.set({ ...abierto.sel });
  }

  protected async eliminarDesdeMenu(): Promise<void> {
    const abierto = this.menu();
    if (!abierto || !this.puedeEliminar()) return;
    const { sel, descripcion } = abierto;
    const conexiones = sel.tipo === 'arco' || sel.tipo === 'mensaje' ? '' : ' También se eliminan los arcos conectados.';
    const aceptado = await this.confirmacion.pedir({
      titulo: 'Eliminar elemento',
      mensaje: `¿Eliminar ${descripcion}?${conexiones}`,
    });
    if (!aceptado) return;

    this.eliminarElemento(sel).subscribe({
      next: (resultado) => {
        this.mostrarAviso(resultado ? resumenEliminacion(resultado) : { tipo: 'ok', texto: 'Mensaje eliminado.' });
        this.cargar(false);
      },
      error: (err: HttpErrorResponse) =>
        this.mostrarAviso({ tipo: 'error', texto: errorMessage(err, 'No se pudo eliminar el elemento.') }),
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  @HostListener('window:blur')
  protected cerrarMenu(): void {
    if (this.menu()) this.menu.set(null);
  }

  // Un clic derecho fuera del lienzo también cierra el menú
  @HostListener('document:contextmenu', ['$event'])
  protected alClicDerechoGlobal(evento: MouseEvent): void {
    if (!this.canvasRef.nativeElement.contains(evento.target as Node)) this.cerrarMenu();
  }

  private seleccionDe(idBpmn: string | undefined): Seleccion | null {
    for (const [patron, tipo] of PATRONES) {
      const coincide = patron.exec(idBpmn ?? '');
      if (coincide) return { tipo, id: Number(coincide[1]) };
    }
    return null;
  }

  private describir(sel: Seleccion, d: Diagrama): string | null {
    const nodos = new Map<number, string>();
    for (const p of d.pools) {
      p.actividades.forEach((a) => nodos.set(a.id, a.nombre));
      p.gateways.forEach((g) => nodos.set(g.id, g.nombre));
      p.eventos.forEach((e) => nodos.set(e.id, e.nombre));
    }
    switch (sel.tipo) {
      case 'actividad':
        return nodos.has(sel.id) ? `la actividad "${nodos.get(sel.id)}"` : null;
      case 'gateway':
        return nodos.has(sel.id) ? `el gateway "${nodos.get(sel.id)}"` : null;
      case 'evento':
        return nodos.has(sel.id) ? `el evento "${nodos.get(sel.id)}"` : null;
      case 'arco': {
        const arco = d.pools.flatMap((p) => p.arcos).find((a) => a.id === sel.id);
        return arco ? `el arco "${nodos.get(arco.origenId)} → ${nodos.get(arco.destinoId)}"` : null;
      }
      case 'mensaje': {
        const mensaje = d.mensajes.find((m) => m.id === sel.id);
        return mensaje ? `el mensaje "${mensaje.nombre}"` : null;
      }
      default:
        return null;
    }
  }

  private eliminarElemento(sel: Seleccion): Observable<Eliminacion | void> {
    switch (sel.tipo) {
      case 'actividad':
        return this.diagramaService.eliminarActividad(sel.id);
      case 'gateway':
        return this.diagramaService.eliminarGateway(sel.id);
      case 'evento':
        return this.diagramaService.eliminarEvento(sel.id);
      case 'arco':
        return this.diagramaService.eliminarArco(sel.id);
      default:
        return this.diagramaService.eliminarMensaje(sel.id);
    }
  }

  protected alternarConectar(): void {
    this.modoConectar.update((v) => !v);
    this.modeler.get('selection').select([]);
  }

  protected iniciarArrastre(evento: DragEvent, item: ItemPaleta): void {
    evento.dataTransfer?.setData(TIPO_MIME_PALETA, item.clave);
    evento.dataTransfer?.setData('text/plain', item.etiqueta);
    if (evento.dataTransfer) evento.dataTransfer.effectAllowed = 'copy';
  }

  protected permitirSoltar(evento: DragEvent): void {
    if (!this.puedeEditar() || !evento.dataTransfer?.types.includes(TIPO_MIME_PALETA)) return;
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
  }

  // Crea en el backend el elemento de la paleta en el punto donde se soltó
  protected soltarElemento(evento: DragEvent): void {
    const item = PALETA.find((i) => i.clave === evento.dataTransfer?.getData(TIPO_MIME_PALETA));
    const diagrama = this.diagrama();
    if (!item || !diagrama || !this.puedeEditar()) return;
    evento.preventDefault();

    const caja = this.canvasRef.nativeElement.getBoundingClientRect();
    const vista = this.modeler.get('canvas').viewbox();
    const x = vista.x + (evento.clientX - caja.left) / vista.scale;
    const y = vista.y + (evento.clientY - caja.top) / vista.scale;

    const banda = this.layout.pools.find((p) => y >= p.top && y <= p.top + p.height);
    const pool = diagrama.pools.find((p) => p.id === banda?.id);
    if (!banda || !pool || banda.blackBox) {
      this.mostrarAviso({ tipo: 'error', texto: 'Suelta el elemento dentro de un pool con lanes.' });
      return;
    }

    const tam = item.tipo === 'actividad' ? TASK_SIZE : item.tipo === 'gateway' ? GATEWAY_SIZE : EVENT_SIZE;
    const posicionX = Math.max(0, Math.round(x - tam.width / 2 - CONTENT_X));
    const acotar = (valor: number, maximo: number) => Math.min(Math.max(0, Math.round(valor)), maximo);

    if (item.tipo === 'actividad') {
      const lane = banda.lanes.find((l) => y >= l.top && y <= l.top + l.height);
      if (!lane) {
        this.mostrarAviso({ tipo: 'error', texto: 'El pool no tiene lanes. Crea una en la pestaña Estructura.' });
        return;
      }
      const nombre = nombreLibre(item.nombre, diagrama.pools.flatMap((p) => p.actividades.map((a) => a.nombre)));
      this.crearDesdePaleta(
        this.diagramaService.crearActividad(lane.id, {
          nombre,
          tipo: item.valor,
          posicionX,
          posicionY: acotar(y - tam.height / 2 - lane.top, LANE_HEIGHT - tam.height),
        }),
        'actividad',
      );
      return;
    }

    const posicionY = acotar(y - tam.height / 2 - banda.top, banda.height - tam.height);
    if (item.tipo === 'gateway') {
      const nombre = nombreLibre(item.nombre, pool.gateways.map((g) => g.nombre));
      this.crearDesdePaleta(
        this.diagramaService.crearGateway(pool.id, { nombre, tipoGateway: item.valor, posicionX, posicionY }),
        'gateway',
      );
    } else {
      const nombre = nombreLibre(item.nombre, pool.eventos.map((e) => e.nombre));
      this.crearDesdePaleta(
        this.diagramaService.crearEvento(pool.id, { nombre, tipoEvento: item.valor, posicionX, posicionY }),
        'evento',
      );
    }
  }

  private crearDesdePaleta(peticion: Observable<{ id: number }>, tipo: TipoSeleccion): void {
    peticion.subscribe({
      next: (creado) => {
        this.mostrarAviso({ tipo: 'ok', texto: 'Elemento creado. Edita su nombre en el panel.' });
        this.cargar(false, { tipo, id: creado.id });
      },
      error: (err: HttpErrorResponse) =>
        this.mostrarAviso({ tipo: 'error', texto: errorMessage(err, 'No se pudo crear el elemento.') }),
    });
  }

  // Crea el arco que se arrastró entre dos nodos del mismo pool
  private alConectar(origen: any, destino: any): void {
    const d = this.diagrama();
    const o = /^\w+_(\d+)$/.exec(origen.id);
    const t = /^\w+_(\d+)$/.exec(destino.id);
    if (!d || !o || !t) return;
    const origenId = Number(o[1]);
    const pool = d.pools.find(
      (p) =>
        p.actividades.some((a) => a.id === origenId) ||
        p.gateways.some((g) => g.id === origenId) ||
        p.eventos.some((e) => e.id === origenId),
    );
    if (!pool) return;
    const pideCondicion = pool.gateways.some((g) => g.id === origenId && g.tipoGateway !== 'PARALELA');

    this.diagramaService.crearArco(pool.id, { origenId, destinoId: Number(t[1]) }).subscribe({
      next: (arco) => {
        this.mostrarAviso({
          tipo: 'ok',
          texto: pideCondicion ? 'Arco creado. Define su condición en el panel.' : 'Arco creado.',
        });
        this.cargar(false, pideCondicion ? { tipo: 'arco', id: arco.id } : null);
      },
      error: (err: HttpErrorResponse) =>
        this.mostrarAviso({ tipo: 'error', texto: errorMessage(err, 'No se pudo crear el arco.') }),
    });
  }

  protected irA(pestana: Pestana): void {
    this.pestana.set(pestana);
  }

  protected zoom(paso: number): void {
    this.modeler.get('zoomScroll').stepZoom(paso);
  }

  protected ajustar(): void {
    this.modeler.get('canvas').zoom('fit-viewport', 'auto');
  }

  protected async exportarBpmn(): Promise<void> {
    const { xml } = await this.modeler.saveXML({ format: true });
    this.descargar(new Blob([xml], { type: 'application/xml' }), `${this.nombreArchivo()}.bpmn`);
  }

  protected async exportarSvg(): Promise<void> {
    const { svg } = await this.modeler.saveSVG();
    this.descargar(new Blob([svg], { type: 'image/svg+xml' }), `${this.nombreArchivo()}.svg`);
  }

  protected volver(): void {
    this.router.navigateByUrl('/procesos');
  }

  private nombreArchivo(): string {
    const nombre = this.diagrama()?.proceso.nombre ?? 'proceso';
    return nombre.trim().replace(/[^\p{L}\p{N}]+/gu, '_') || 'proceso';
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  private cargar(primeraVez: boolean, seleccionar: Seleccion | null = null): void {
    const procesoId = Number(this.id());
    forkJoin({
      diagrama: this.diagramaService.obtener(procesoId),
      advertencias: this.diagramaService.validar(procesoId).pipe(catchError(() => of([] as Advertencia[]))),
    }).subscribe({
      next: async ({ diagrama, advertencias }) => {
        if (this.destruido) return;
        this.diagrama.set(diagrama);
        this.advertencias.set(advertencias);
        this.seleccion.set(null);
        await this.dibujar(diagrama, primeraVez);
        this.cargando.set(false);
        if (seleccionar) {
          this.pestana.set(PESTANA_DE[seleccionar.tipo]);
          this.seleccion.set(seleccionar);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.mostrarAviso({ tipo: 'error', texto: errorMessage(err, 'No se pudo cargar el diagrama.') });
        if (primeraVez) this.router.navigateByUrl('/procesos');
      },
    });
  }

  private async dibujar(diagrama: Diagrama, ajustarVista: boolean): Promise<void> {
    const canvas = this.modeler.get('canvas');
    const vista = ajustarVista ? null : canvas.viewbox();
    const { xml, layout } = construirBpmn(diagrama);
    this.layout = layout;

    try {
      await this.modeler.importXML(xml);
    } catch {
      this.mostrarAviso({ tipo: 'error', texto: 'No se pudo dibujar el diagrama.' });
      return;
    }

    const registro = this.modeler.get('elementRegistry');
    const modelado = this.modeler.get('modeling');
    registro
      .filter((el: any) => el.waypoints)
      .forEach((conexion: any) => modelado.layoutConnection(conexion));
    this.modeler.get('commandStack').clear();

    try {
      if (vista) canvas.viewbox(vista);
      else canvas.zoom('fit-viewport', 'auto');
    } catch {
      // el contenedor aún no tiene tamaño: se conserva la vista por defecto
    }

    this.marcarAdvertencias();
  }

  private marcarAdvertencias(): void {
    const canvas = this.modeler.get('canvas');
    const registro = this.modeler.get('elementRegistry');
    for (const a of this.advertencias()) {
      const prefijo = PREFIJO_ELEMENTO[(a.elemento ?? '').toUpperCase()];
      if (!prefijo || a.elementoId === null) continue;
      const id = `${prefijo}_${a.elementoId}`;
      if (!registro.get(id)) continue;
      canvas.addMarker(id, a.nivel === 'ERROR' ? 'con-error' : 'con-advertencia');
    }
  }

  private alSeleccionar(elemento: any): void {
    const id: string | undefined = elemento?.id;
    if (!id) {
      this.seleccion.set(null);
      return;
    }
    for (const [patron, tipo] of PATRONES) {
      const coincide = patron.exec(id);
      if (coincide) {
        this.seleccion.set({ tipo, id: Number(coincide[1]) });
        this.pestana.set(PESTANA_DE[tipo]);
        return;
      }
    }
    this.seleccion.set(null);
  }

  // Guarda la nueva posición (y la lane) de los elementos que se arrastraron
  private alMover(formas: any[]): void {
    const d = this.diagrama();
    if (!d || !this.puedeEditar()) return;

    const peticiones = [];
    let revertir = false;

    for (const forma of formas) {
      const coincide = /^(Actividad|Gateway|Evento)_(\d+)$/.exec(forma.id);
      if (!coincide) continue;
      const nodoId = Number(coincide[2]);
      const centroY = forma.y + forma.height / 2;
      const destino = this.layout.pools.find((p) => centroY >= p.top && centroY <= p.top + p.height);
      const origen = d.pools.find(
        (p) =>
          p.actividades.some((a) => a.id === nodoId && coincide[1] === 'Actividad') ||
          p.gateways.some((g) => g.id === nodoId && coincide[1] === 'Gateway') ||
          p.eventos.some((e) => e.id === nodoId && coincide[1] === 'Evento'),
      );
      if (!destino || !origen || destino.id !== origen.id || destino.blackBox) {
        revertir = true;
        continue;
      }

      const posicionX = Math.max(0, Math.round(forma.x - CONTENT_X));
      const limite = (alto: number) => destino.height - alto;

      if (coincide[1] === 'Actividad') {
        const actividad = origen.actividades.find((a) => a.id === nodoId)!;
        const lane =
          destino.lanes.find((l) => centroY >= l.top && centroY <= l.top + l.height) ?? destino.lanes[0];
        const posicionY = Math.min(
          Math.max(0, Math.round(forma.y - lane.top)),
          LANE_HEIGHT - TASK_SIZE.height,
        );
        peticiones.push(
          this.diagramaService.actualizarActividad(nodoId, {
            nombre: actividad.nombre,
            tipo: actividad.tipo,
            descripcion: actividad.descripcion,
            laneId: lane.id,
            posicionX,
            posicionY,
          }),
        );
      } else if (coincide[1] === 'Gateway') {
        const gateway = origen.gateways.find((g) => g.id === nodoId)!;
        const posicionY = Math.min(Math.max(0, Math.round(forma.y - destino.top)), limite(GATEWAY_SIZE.height));
        peticiones.push(
          this.diagramaService.actualizarGateway(nodoId, {
            nombre: gateway.nombre,
            tipoGateway: gateway.tipoGateway,
            posicionX,
            posicionY,
          }),
        );
      } else {
        const evento = origen.eventos.find((e) => e.id === nodoId)!;
        const posicionY = Math.min(Math.max(0, Math.round(forma.y - destino.top)), limite(EVENT_SIZE.height));
        peticiones.push(
          this.diagramaService.actualizarEvento(nodoId, {
            nombre: evento.nombre,
            tipoEvento: evento.tipoEvento,
            contenido: evento.contenido,
            origenExterno: evento.origenExterno,
            claveCorrelacion: evento.claveCorrelacion,
            actividadesUsuarias: evento.actividadesUsuarias,
            posicionX,
            posicionY,
          }),
        );
      }
    }

    if (peticiones.length === 0) {
      if (revertir) setTimeout(() => this.cargar(false));
      return;
    }

    forkJoin(peticiones).subscribe({
      next: () => this.cargar(false),
      error: (err: HttpErrorResponse) => {
        this.mostrarAviso({ tipo: 'error', texto: errorMessage(err, 'No se pudo guardar la posición.') });
        this.cargar(false);
      },
    });
  }
}
