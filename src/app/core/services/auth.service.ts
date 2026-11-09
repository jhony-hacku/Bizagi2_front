import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, defer, finalize, firstValueFrom, from, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterCompanyRequest } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // El access vive en memoria; al recargar se recupera la sesion con la cookie HttpOnly.
  private readonly session = signal<AuthResponse | null>(null);
  private renovacion?: Observable<AuthResponse>;
  private readonly authUrl = `${environment.apiUrl}/auth`;

  readonly currentUser = computed(() => this.session());
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly puedeEscribir = computed(() => ['ADMINISTRADOR', 'EDITOR'].includes(this.session()?.rolAcceso ?? ''));
  readonly esAdministrador = computed(() => this.session()?.rolAcceso === 'ADMINISTRADOR');

  constructor(private readonly http: HttpClient) {
    localStorage.removeItem('bizagi2_session');
  }

  restore(): Observable<void> {
    return this.refresh().pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const body: LoginRequest = { email, password };
    return this.conBloqueo(() => this.csrf().pipe(
      switchMap(() => this.http.post<AuthResponse>(`${this.authUrl}/login`, body)),
      tap((session) => this.session.set(session)),
    ));
  }

  registerCompany(request: RegisterCompanyRequest): Observable<AuthResponse> {
    return this.conBloqueo(() => this.csrf().pipe(
      switchMap(() => this.http.post<AuthResponse>(`${this.authUrl}/register`, request)),
      tap((session) => this.session.set(session)),
    ));
  }

  refresh(): Observable<AuthResponse> {
    // Todos los 401 concurrentes comparten una sola renovacion.
    if (!this.renovacion) {
      this.renovacion = this.conBloqueo(() => this.csrf().pipe(
        switchMap(() => this.http.post<AuthResponse>(`${this.authUrl}/refresh`, null)),
        tap((session) => this.session.set(session)),
      )).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => { this.renovacion = undefined; }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.renovacion;
  }

  logout(): Observable<void> {
    return this.conBloqueo(() => this.csrf().pipe(
      switchMap(() => this.http.post<void>(`${this.authUrl}/logout`, null)),
      tap(() => this.clearSession()),
    ));
  }

  clearSession(): void { this.session.set(null); }

  getToken(): string | null { return this.session()?.token ?? null; }

  private csrf(): Observable<void> {
    // Angular envia XSRF-TOKEN en la cabecera X-XSRF-TOKEN de las peticiones relativas.
    return this.http.get<void>(`${this.authUrl}/csrf`);
  }

  private conBloqueo<T>(operacion: () => Observable<T>): Observable<T> {
    // Las cookies se comparten entre pestañas: no deben rotar el mismo refresh a la vez.
    return defer(() => navigator.locks
      ? from(navigator.locks.request('bizagi2-auth', () => firstValueFrom(operacion())))
      : operacion());
  }
}
