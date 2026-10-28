// Contratos de /api/usuarios, /api/empresa y /api/roles-proceso

import { RolAcceso } from './auth.model';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rolAcceso: RolAcceso;
  activo: boolean;
  empresaId: number;
}

export interface UsuarioCreateRequest {
  nombre: string;
  email: string;
  password: string;
  rolAcceso: RolAcceso;
}

export interface UsuarioUpdateRequest {
  nombre?: string;
  email?: string;
  password?: string;
  rolAcceso?: RolAcceso;
}

export interface Empresa {
  id: number;
  nombre: string;
  nit: string;
  emailContacto: string;
  editorModificaEstructura: boolean;
}

export interface EmpresaRequest {
  nombre: string;
  nit: string;
  emailContacto: string;
  editorModificaEstructura?: boolean;
}

export interface RolProceso {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface RolProcesoRequest {
  nombre: string;
  descripcion: string;
}

export interface ProcesoResumen {
  id: number;
  nombre: string;
}

export interface RolProcesoDetalle extends RolProceso {
  enUso: boolean;
  eliminable: boolean;
  procesos: ProcesoResumen[];
}
