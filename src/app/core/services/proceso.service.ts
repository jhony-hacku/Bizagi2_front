import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HistorialEntry,
  PagedResponse,
  Proceso,
  ProcesoFiltros,
  ProcesoRequest,
} from '../models/proceso.model';

@Injectable({ providedIn: 'root' })
export class ProcesoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/procesos`;

  // HU-07
  listar(filtros: ProcesoFiltros): Observable<PagedResponse<Proceso>> {
    let params = new HttpParams()
      .set('activo', filtros.activo)
      .set('page', filtros.page)
      .set('size', filtros.size);
    if (filtros.nombre.trim()) params = params.set('nombre', filtros.nombre.trim());
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.categoria.trim()) params = params.set('categoria', filtros.categoria.trim());
    return this.http.get<PagedResponse<Proceso>>(this.baseUrl, { params });
  }

  buscar(id: number): Observable<Proceso> {
    return this.http.get<Proceso>(`${this.baseUrl}/${id}`);
  }

  // HU-04
  crear(datos: ProcesoRequest): Observable<Proceso> {
    return this.http.post<Proceso>(this.baseUrl, datos);
  }

  // HU-05
  actualizar(id: number, datos: ProcesoRequest): Observable<Proceso> {
    return this.http.put<Proceso>(`${this.baseUrl}/${id}`, datos);
  }

  // HU-06: eliminación lógica
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  historial(id: number): Observable<HistorialEntry[]> {
    return this.http.get<HistorialEntry[]>(`${this.baseUrl}/${id}/historial`);
  }
}
