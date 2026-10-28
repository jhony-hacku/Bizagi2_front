import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Actividad,
  ActividadRequest,
  Advertencia,
  Arco,
  ArcoRequest,
  Correlacion,
  CorrelacionRequest,
  Diagrama,
  Eliminacion,
  EmpresaInvitada,
  Evento,
  EventoRequest,
  Gateway,
  GatewayRequest,
  Lane,
  LaneRequest,
  Mensaje,
  MensajeRequest,
  Pool,
  PoolRequest,
  ProcesoCompartido,
} from '../models/diagrama.model';
import { RolProceso } from '../models/organizacion.model';

const API = environment.apiUrl;

// Diagrama completo de un proceso y sus elementos
@Injectable({ providedIn: 'root' })
export class DiagramaService {
  private readonly http = inject(HttpClient);

  obtener(procesoId: number): Observable<Diagrama> {
    return this.http.get<Diagrama>(`${API}/procesos/${procesoId}/diagrama`);
  }

  validar(procesoId: number): Observable<Advertencia[]> {
    return this.http.get<Advertencia[]>(`${API}/procesos/${procesoId}/validacion`);
  }

  // Pools (HU-21)
  crearPool(procesoId: number, datos: PoolRequest): Observable<Pool> {
    return this.http.post<Pool>(`${API}/procesos/${procesoId}/pools`, datos);
  }

  actualizarPool(id: number, datos: PoolRequest): Observable<Pool> {
    return this.http.put<Pool>(`${API}/pools/${id}`, datos);
  }

  eliminarPool(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/pools/${id}`);
  }

  // Lanes (HU-22, HU-24)
  rolesDisponibles(poolId: number): Observable<RolProceso[]> {
    return this.http.get<RolProceso[]>(`${API}/pools/${poolId}/roles-disponibles`);
  }

  crearLane(poolId: number, datos: LaneRequest): Observable<Lane> {
    return this.http.post<Lane>(`${API}/pools/${poolId}/lanes`, datos);
  }

  actualizarLane(id: number, datos: LaneRequest): Observable<Lane> {
    return this.http.put<Lane>(`${API}/lanes/${id}`, datos);
  }

  reordenarLanes(poolId: number, idsEnOrden: number[]): Observable<Lane[]> {
    return this.http.put<Lane[]>(`${API}/pools/${poolId}/lanes/orden`, idsEnOrden);
  }

  eliminarLane(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/lanes/${id}`);
  }

  // Actividades (HU-08 a HU-10)
  crearActividad(laneId: number, datos: ActividadRequest): Observable<Actividad> {
    return this.http.post<Actividad>(`${API}/lanes/${laneId}/actividades`, datos);
  }

  actualizarActividad(id: number, datos: ActividadRequest): Observable<Actividad> {
    return this.http.put<Actividad>(`${API}/actividades/${id}`, datos);
  }

  eliminarActividad(id: number): Observable<Eliminacion> {
    return this.http.delete<Eliminacion>(`${API}/actividades/${id}`);
  }

  // Gateways (HU-14 a HU-16)
  crearGateway(poolId: number, datos: GatewayRequest): Observable<Gateway> {
    return this.http.post<Gateway>(`${API}/pools/${poolId}/gateways`, datos);
  }

  actualizarGateway(id: number, datos: GatewayRequest): Observable<Gateway> {
    return this.http.put<Gateway>(`${API}/gateways/${id}`, datos);
  }

  eliminarGateway(id: number): Observable<Eliminacion> {
    return this.http.delete<Eliminacion>(`${API}/gateways/${id}`);
  }

  // Eventos (HU-25, HU-27)
  crearEvento(poolId: number, datos: EventoRequest): Observable<Evento> {
    return this.http.post<Evento>(`${API}/pools/${poolId}/eventos`, datos);
  }

  actualizarEvento(id: number, datos: EventoRequest): Observable<Evento> {
    return this.http.put<Evento>(`${API}/eventos/${id}`, datos);
  }

  eliminarEvento(id: number): Observable<Eliminacion> {
    return this.http.delete<Eliminacion>(`${API}/eventos/${id}`);
  }

  // Arcos (HU-11 a HU-13)
  listarArcos(poolId: number): Observable<Arco[]> {
    return this.http.get<Arco[]>(`${API}/pools/${poolId}/arcos`);
  }

  crearArco(poolId: number, datos: ArcoRequest): Observable<Arco> {
    return this.http.post<Arco>(`${API}/pools/${poolId}/arcos`, datos);
  }

  actualizarArco(id: number, datos: ArcoRequest): Observable<Arco> {
    return this.http.put<Arco>(`${API}/arcos/${id}`, datos);
  }

  eliminarArco(id: number): Observable<Eliminacion> {
    return this.http.delete<Eliminacion>(`${API}/arcos/${id}`);
  }

  // Mensajes (HU-25, HU-26) y correlación (HU-28)
  listarMensajes(procesoId: number): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(`${API}/procesos/${procesoId}/mensajes`);
  }

  crearMensaje(procesoId: number, datos: MensajeRequest): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${API}/procesos/${procesoId}/mensajes`, datos);
  }

  actualizarMensaje(id: number, datos: MensajeRequest): Observable<Mensaje> {
    return this.http.put<Mensaje>(`${API}/mensajes/${id}`, datos);
  }

  eliminarMensaje(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/mensajes/${id}`);
  }

  crearCorrelacion(mensajeId: number, datos: CorrelacionRequest): Observable<Correlacion> {
    return this.http.post<Correlacion>(`${API}/mensajes/${mensajeId}/correlacion`, datos);
  }

  actualizarCorrelacion(mensajeId: number, datos: CorrelacionRequest): Observable<Correlacion> {
    return this.http.put<Correlacion>(`${API}/mensajes/${mensajeId}/correlacion`, datos);
  }

  eliminarCorrelacion(mensajeId: number): Observable<void> {
    return this.http.delete<void>(`${API}/mensajes/${mensajeId}/correlacion`);
  }

  // Compartir procesos (HU-23)
  compartidosConmigo(): Observable<ProcesoCompartido[]> {
    return this.http.get<ProcesoCompartido[]>(`${API}/procesos/compartidos`);
  }

  invitadas(procesoId: number): Observable<EmpresaInvitada[]> {
    return this.http.get<EmpresaInvitada[]>(`${API}/procesos/${procesoId}/compartir`);
  }

  compartir(procesoId: number, nit: string): Observable<EmpresaInvitada> {
    return this.http.post<EmpresaInvitada>(`${API}/procesos/${procesoId}/compartir`, { nit });
  }

  dejarDeCompartir(procesoId: number, empresaId: number): Observable<void> {
    return this.http.delete<void>(`${API}/procesos/${procesoId}/compartir/${empresaId}`);
  }
}
