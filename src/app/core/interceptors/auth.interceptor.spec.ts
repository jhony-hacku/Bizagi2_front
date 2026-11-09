import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { AuthResponse } from '../models/auth.model';

describe('Sesion JWT', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let auth: AuthService;
  const session: AuthResponse = { token: 'access-a', tokenType: 'Bearer', expiresIn: 900,
    usuarioId: 1, nombre: 'Ana', email: 'ana@example.com', rolAcceso: 'EDITOR', empresaId: 1, empresa: 'Acme' };

  beforeEach(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: { navigateByUrl: vi.fn() } },
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => requests.verify());

  function login(): void {
    auth.login('ana@example.com', 'Password123!').subscribe();
    requests.expectOne('/api/auth/csrf').flush(null);
    const request = requests.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(session);
  }

  it('conserva el access en memoria y no en localStorage', () => {
    login();
    expect(auth.getToken()).toBe('access-a');
    expect(localStorage.getItem('bizagi2_session')).toBeNull();
  });

  it('recupera una sesion al recargar mediante refresh', () => {
    expect(auth.getToken()).toBeNull();
    auth.restore().subscribe();
    requests.expectOne('/api/auth/csrf').flush(null);
    requests.expectOne('/api/auth/refresh').flush(session);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('dos 401 simultaneos comparten refresh y reintentan con el access nuevo', () => {
    login();
    const received: unknown[] = [];
    http.get('/api/procesos').subscribe(value => received.push(value));
    http.get('/api/empresa').subscribe(value => received.push(value));
    const originals = requests.match(request => request.url === '/api/procesos' || request.url === '/api/empresa');
    originals.forEach(request => {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-a');
      request.flush({}, { status: 401, statusText: 'Unauthorized' });
    });
    requests.expectOne('/api/auth/csrf').flush(null);
    requests.expectOne('/api/auth/refresh').flush({ ...session, token: 'access-b' });
    const retries = requests.match(request => request.url === '/api/procesos' || request.url === '/api/empresa');
    expect(retries).toHaveLength(2);
    retries.forEach(request => {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-b');
      request.flush({ ok: true });
    });
    expect(received).toHaveLength(2);
  });

  it('no envia el token a otros servidores ni intenta renovar sus errores', () => {
    login();
    http.get('https://externo.example/api').subscribe({ error: () => undefined });
    const request = requests.expectOne('https://externo.example/api');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectNone('/api/auth/refresh');
  });

  it('un 403 no renueva ni cierra la sesion', () => {
    login();
    http.get('/api/usuarios').subscribe({ error: () => undefined });
    requests.expectOne('/api/usuarios').flush({}, { status: 403, statusText: 'Forbidden' });
    requests.expectNone('/api/auth/refresh');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('refresh rechazado limpia la sesion y redirige sin bucles', () => {
    login();
    http.get('/api/procesos').subscribe({ error: () => undefined });
    requests.expectOne('/api/procesos').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/auth/csrf').flush(null);
    requests.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('un fallo de red durante logout no simula un cierre exitoso', () => {
    login();
    auth.logout().subscribe({ error: () => undefined });
    requests.expectOne('/api/auth/csrf').flush(null);
    requests.expectOne('/api/auth/logout').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('logout usa la cookie y borra la sesion solo al confirmar el servidor', () => {
    login();
    auth.logout().subscribe();
    requests.expectOne('/api/auth/csrf').flush(null);
    const request = requests.expectOne('/api/auth/logout');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null);
    expect(auth.isAuthenticated()).toBe(false);
  });
});
