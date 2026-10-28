// Contratos de /api/auth/login, /api/auth/register y /api/auth/logout

export type RolAcceso = 'ADMINISTRADOR' | 'EDITOR' | 'LECTOR';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  usuarioId: number;
  nombre: string;
  email: string;
  rolAcceso: RolAcceso;
  empresaId: number;
  empresa: string;
}

export interface RegisterCompanyRequest {
  nombreEmpresa: string;
  nit: string;
  emailContacto: string;
  nombre: string;
  email: string;
  password: string;
}

export interface ApiErrorResponse {
  status: number;
  message: string;
  timestamp: string;
}
