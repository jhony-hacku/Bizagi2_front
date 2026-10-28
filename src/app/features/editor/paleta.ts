import { TipoActividad, TipoEvento, TipoGateway } from '../../core/models/diagrama.model';

// Elementos que se arrastran desde la paleta al lienzo

export type ItemPaleta =
  | { clave: string; etiqueta: string; icono: string; tipo: 'actividad'; valor: TipoActividad; nombre: string }
  | { clave: string; etiqueta: string; icono: string; tipo: 'gateway'; valor: TipoGateway; nombre: string }
  | { clave: string; etiqueta: string; icono: string; tipo: 'evento'; valor: TipoEvento; nombre: string };

export const PALETA: ItemPaleta[] = [
  { clave: 'tarea', etiqueta: 'Tarea', icono: 'tarea', tipo: 'actividad', valor: 'TAREA', nombre: 'Nueva tarea' },
  { clave: 'usuario', etiqueta: 'Tarea de usuario', icono: 'tarea', tipo: 'actividad', valor: 'USUARIO', nombre: 'Nueva tarea de usuario' },
  { clave: 'envio', etiqueta: 'Tarea de envío', icono: 'tarea', tipo: 'actividad', valor: 'ENVIO', nombre: 'Nuevo envío' },
  { clave: 'gw-x', etiqueta: 'Gateway exclusivo', icono: 'gateway', tipo: 'gateway', valor: 'EXCLUSIVA', nombre: 'Nuevo gateway' },
  { clave: 'gw-p', etiqueta: 'Gateway paralelo', icono: 'gateway', tipo: 'gateway', valor: 'PARALELA', nombre: 'Nuevo gateway paralelo' },
  { clave: 'gw-i', etiqueta: 'Gateway inclusivo', icono: 'gateway', tipo: 'gateway', valor: 'INCLUSIVA', nombre: 'Nuevo gateway inclusivo' },
  { clave: 'inicio', etiqueta: 'Inicio', icono: 'inicio', tipo: 'evento', valor: 'INICIO', nombre: 'Inicio' },
  { clave: 'fin', etiqueta: 'Fin', icono: 'fin', tipo: 'evento', valor: 'FIN', nombre: 'Fin' },
  { clave: 'msg-env', etiqueta: 'Enviar mensaje', icono: 'mensaje', tipo: 'evento', valor: 'MENSAJE_LANZAMIENTO', nombre: 'Mensaje enviado' },
  { clave: 'msg-ini', etiqueta: 'Recibir mensaje (inicio)', icono: 'inicio', tipo: 'evento', valor: 'MENSAJE_RECEPCION_INICIO', nombre: 'Mensaje de inicio' },
  { clave: 'msg-int', etiqueta: 'Recibir mensaje', icono: 'mensaje', tipo: 'evento', valor: 'MENSAJE_RECEPCION_INTERMEDIO', nombre: 'Mensaje recibido' },
];

export const TIPO_MIME_PALETA = 'application/x-bizagi-elemento';

// Primer nombre libre a partir del nombre base: "Nueva tarea", "Nueva tarea 2", ...
export function nombreLibre(base: string, usados: string[]): string {
  const minusculas = new Set(usados.map((n) => n.trim().toLowerCase()));
  if (!minusculas.has(base.toLowerCase())) return base;
  let n = 2;
  while (minusculas.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
