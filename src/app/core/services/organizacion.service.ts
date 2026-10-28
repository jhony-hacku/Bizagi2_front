import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HistorialEntry, PagedResponse } from '../models/proceso.model';
import {
  Empresa,
  EmpresaRequest,
  RolProceso,
  RolProcesoDetalle,
  RolProcesoRequest,
  Usuario,
  UsuarioCreateRequest,
  UsuarioUpdateRequest,
} from '../models/organizacion.model';

// Usuarios (HU-02)
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  crear(datos: UsuarioCreateRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.baseUrl, datos);
  }

  actualizar(id: number, datos: UsuarioUpdateRequest): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.baseUrl}/${id}`, datos);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  activar(id: number): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.baseUrl}/${id}/activar`, null);
  }
}

// Empresa (HU-01, HU-24)
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/empresa`;

  obtener(): Observable<Empresa> {
    return this.http.get<Empresa>(this.baseUrl);
  }

  actualizar(datos: EmpresaRequest): Observable<Empresa> {
    return this.http.put<Empresa>(this.baseUrl, datos);
  }
}

// Roles de proceso (HU-17 a HU-20)
@Injectable({ providedIn: 'root' })
export class RolProcesoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/roles-proceso`;

  listar(nombre: string, page: number, size: number): Observable<PagedResponse<RolProcesoDetalle>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (nombre.trim()) params = params.set('nombre', nombre.trim());
    return this.http.get<PagedResponse<RolProcesoDetalle>>(this.baseUrl, { params });
  }

  crear(datos: RolProcesoRequest): Observable<RolProceso> {
    return this.http.post<RolProceso>(this.baseUrl, datos);
  }

  actualizar(id: number, datos: RolProcesoRequest): Observable<RolProceso> {
    return this.http.put<RolProceso>(`${this.baseUrl}/${id}`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  historial(id: number): Observable<HistorialEntry[]> {
    return this.http.get<HistorialEntry[]>(`${this.baseUrl}/${id}/historial`);
  }
}
