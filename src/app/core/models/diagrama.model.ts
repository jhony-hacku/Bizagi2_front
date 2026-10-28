// Contratos del diagrama: pools, lanes, nodos, arcos y mensajes

import { EstadoProceso } from './proceso.model';

export type TipoActividad = 'TAREA' | 'USUARIO' | 'MANUAL' | 'SERVICIO' | 'ENVIO';
export type TipoEvento =
  | 'INICIO'
  | 'FIN'
  | 'MENSAJE_LANZAMIENTO'
  | 'MENSAJE_RECEPCION_INICIO'
  | 'MENSAJE_RECEPCION_INTERMEDIO';
export type TipoGateway = 'EXCLUSIVA' | 'PARALELA' | 'INCLUSIVA';
export type TipoParticipante = 'EMPRESA_PROPIETARIA' | 'CLIENTE' | 'PROVEEDOR' | 'SISTEMA_EXTERNO';
export type TipoDestino = 'CORREO' | 'SERVICIO_WEB' | 'COLA';
export type AccionFallo = 'CONTINUAR_FLUJO' | 'DERIVAR_A_MANEJO_ERROR' | 'FINALIZAR_PROCESO';
export type AccionSinCaso = 'DESCARTAR' | 'INICIAR_CASO_NUEVO';

export interface Pool {
  id: number;
  nombre: string;
  tipoParticipante: TipoParticipante;
  procesoId: number;
}

export interface PoolRequest {
  nombre: string;
  tipoParticipante: TipoParticipante;
}

export interface Lane {
  id: number;
  nombre: string;
  orden: number;
  poolId: number;
  rolProcesoId: number;
  rolProcesoNombre: string;
}

export interface LaneRequest {
  rolProcesoId?: number | null;
  nombre?: string | null;
}

export interface Actividad {
  id: number;
  nombre: string;
  tipo: TipoActividad;
  descripcion: string | null;
  posicionX: number;
  posicionY: number;
  poolId: number;
  laneId: number;
}

export interface ActividadRequest {
  nombre: string;
  tipo: TipoActividad;
  descripcion?: string | null;
  posicionX?: number | null;
  posicionY?: number | null;
  laneId?: number | null;
}

export interface Gateway {
  id: number;
  nombre: string;
  tipoGateway: TipoGateway;
  posicionX: number;
  posicionY: number;
  poolId: number;
}

export interface GatewayRequest {
  nombre: string;
  tipoGateway: TipoGateway;
  posicionX?: number | null;
  posicionY?: number | null;
}

export interface Evento {
  id: number;
  nombre: string;
  tipoEvento: TipoEvento;
  posicionX: number;
  posicionY: number;
  contenido: string | null;
  origenExterno: boolean | null;
  claveCorrelacion: string | null;
  actividadesUsuarias: number[] | null;
  poolId: number;
}

export interface EventoRequest {
  nombre: string;
  tipoEvento: TipoEvento;
  posicionX?: number | null;
  posicionY?: number | null;
  contenido?: string | null;
  origenExterno?: boolean | null;
  claveCorrelacion?: string | null;
  actividadesUsuarias?: number[] | null;
}

export interface Arco {
  id: number;
  poolId: number;
  origenId: number;
  origenNombre: string;
  destinoId: number;
  destinoNombre: string;
  etiqueta: string | null;
  condicion: string | null;
}

export interface ArcoRequest {
  origenId: number;
  destinoId: number;
  etiqueta?: string | null;
  condicion?: string | null;
}

export interface Mensaje {
  id: number;
  procesoId: number;
  nombre: string;
  origenId: number;
  origenNombre: string;
  destinoPoolId: number;
  destinoPoolNombre: string;
  contenido: string | null;
  tipoDestino: TipoDestino | null;
  momento: string | null;
  accionFallo: AccionFallo | null;
  actividadErrorId: number | null;
  actividadErrorNombre: string | null;
}

export interface MensajeRequest {
  nombre: string;
  origenId: number;
  destinoPoolId: number;
  contenido?: string | null;
  tipoDestino?: TipoDestino | null;
  momento?: string | null;
  accionFallo?: AccionFallo | null;
  actividadErrorId?: number | null;
}

export interface Correlacion {
  id: number;
  mensajeId: number;
  criterio: string;
  accionSinCaso: AccionSinCaso;
}

export interface CorrelacionRequest {
  criterio: string;
  accionSinCaso: AccionSinCaso;
}

// Respuesta de GET /api/procesos/{id}/diagrama

export interface DiagramaProceso {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  estado: EstadoProceso;
  activo: boolean;
  propio: boolean;
}

export interface DiagramaLane {
  id: number;
  nombre: string;
  orden: number;
  rolProcesoId?: number;
  rolProceso?: string;
}

export interface DiagramaActividad {
  id: number;
  nombre: string;
  tipo: TipoActividad;
  descripcion: string | null;
  posicionX: number;
  posicionY: number;
  laneId: number;
  rolProcesoId?: number;
}

export interface DiagramaArco {
  id: number;
  origenId: number;
  destinoId: number;
  etiqueta: string | null;
  condicion: string | null;
}

export interface DiagramaCorrelacion {
  criterio: string;
  accionSinCaso: AccionSinCaso;
}

export interface DiagramaMensaje {
  id: number;
  nombre: string;
  origenId: number;
  origenPoolId: number;
  destinoPoolId: number;
  contenido: string | null;
  tipoDestino: TipoDestino | null;
  momento: string | null;
  accionFallo: AccionFallo | null;
  actividadErrorId: number | null;
  correlacion: DiagramaCorrelacion | null;
}

export interface DiagramaPool {
  id: number;
  nombre: string;
  tipoParticipante: TipoParticipante;
  lanes: DiagramaLane[];
  actividades: DiagramaActividad[];
  gateways: Gateway[];
  eventos: Evento[];
  arcos: DiagramaArco[];
}

export interface Diagrama {
  proceso: DiagramaProceso;
  pools: DiagramaPool[];
  mensajes: DiagramaMensaje[];
}

export interface Advertencia {
  nivel: 'ERROR' | 'ADVERTENCIA';
  elemento: string;
  elementoId: number | null;
  mensaje: string;
}

export interface Eliminacion {
  arcosEliminados: number;
  mensajesEliminados: number;
  advertencias: Advertencia[];
}

// Procesos compartidos (HU-23)

export interface EmpresaInvitada {
  empresaId: number;
  empresa: string;
  nit: string;
  compartidoDesde: string;
}

export interface ProcesoCompartido {
  procesoId: number;
  nombre: string;
  categoria: string | null;
  estado: EstadoProceso;
  empresaPropietaria: string;
  compartidoDesde: string;
}
