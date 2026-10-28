import { TipoActividad, TipoDestino, TipoEvento, TipoGateway, TipoParticipante } from '../../../core/models/diagrama.model';

export type TipoSeleccion = 'actividad' | 'gateway' | 'evento' | 'arco' | 'mensaje' | 'pool' | 'lane';

export interface Seleccion {
  tipo: TipoSeleccion;
  id: number;
}

export interface Aviso {
  tipo: 'ok' | 'error' | 'warn';
  texto: string;
}

export const ETIQUETA_ACTIVIDAD: Record<TipoActividad, string> = {
  TAREA: 'Tarea',
  USUARIO: 'Tarea de usuario',
  MANUAL: 'Tarea manual',
  SERVICIO: 'Tarea de servicio',
  ENVIO: 'Tarea de envío',
};

export const ETIQUETA_GATEWAY: Record<TipoGateway, string> = {
  EXCLUSIVA: 'Exclusivo (X)',
  PARALELA: 'Paralelo (+)',
  INCLUSIVA: 'Inclusivo (O)',
};

export const ETIQUETA_EVENTO: Record<TipoEvento, string> = {
  INICIO: 'Inicio',
  FIN: 'Fin',
  MENSAJE_LANZAMIENTO: 'Lanzamiento de mensaje',
  MENSAJE_RECEPCION_INICIO: 'Recepción de mensaje (inicio)',
  MENSAJE_RECEPCION_INTERMEDIO: 'Recepción de mensaje (intermedio)',
};

export const ETIQUETA_PARTICIPANTE: Record<TipoParticipante, string> = {
  EMPRESA_PROPIETARIA: 'Empresa propietaria',
  CLIENTE: 'Cliente',
  PROVEEDOR: 'Proveedor',
  SISTEMA_EXTERNO: 'Sistema externo',
};

export const ETIQUETA_DESTINO: Record<TipoDestino, string> = {
  CORREO: 'Correo electrónico',
  SERVICIO_WEB: 'Servicio web',
  COLA: 'Cola de mensajes',
};

export function entradas<T extends string>(mapa: Record<T, string>): { valor: T; etiqueta: string }[] {
  return (Object.keys(mapa) as T[]).map((valor) => ({ valor, etiqueta: mapa[valor] }));
}
