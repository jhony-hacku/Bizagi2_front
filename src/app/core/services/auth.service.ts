import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterCompanyRequest } from '../models/auth.model';

const STORAGE_KEY = 'bizagi2_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<AuthResponse | null>(this.readFromStorage());

  readonly currentUser = computed(() => this.session());
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly puedeEscribir = computed(() => {
    const rol = this.session()?.rolAcceso;
    return rol === 'ADMINISTRADOR' || rol === 'EDITOR';
  });
  readonly esAdministrador = computed(() => this.session()?.rolAcceso === 'ADMINISTRADOR');

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResponse> {
    const body: LoginRequest = { email, password };
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, body)
      .pipe(tap((response) => this.persistSession(response)));
  }

  // HU-01
  registerCompany(request: RegisterCompanyRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, request);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, null).pipe(
      catchError(() => of(undefined)),
      tap(() => this.clearSession()),
      map(() => undefined),
    );
  }

  clearSession(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  private persistSession(response: AuthResponse): void {
    this.session.set(response);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  }

  private readFromStorage(): AuthResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  }
}
