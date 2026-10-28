// Contratos de /api/procesos

export type EstadoProceso = 'BORRADOR' | 'PUBLICADO';

export interface Proceso {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  estado: EstadoProceso;
  activo: boolean;
  empresaId: number;
}

export interface ProcesoRequest {
  nombre: string;
  descripcion: string;
  categoria: string;
  estado?: EstadoProceso;
}

export interface HistorialEntry {
  id: number;
  accion: string;
  entidad: string;
  entidadId: number;
  fecha: string;
  detalle: string;
  usuarioId: number;
  usuarioNombre: string;
}

export interface PageInfo {
  size: number;
  number: number;
  totalElements: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  content: T[];
  page: PageInfo;
}

export interface ProcesoFiltros {
  nombre: string;
  estado: EstadoProceso | '';
  categoria: string;
  activo: boolean;
  page: number;
  size: number;
}
