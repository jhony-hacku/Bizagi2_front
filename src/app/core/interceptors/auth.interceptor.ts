import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${environment.apiUrl}/`) || req.url.startsWith(`${environment.apiUrl}/auth/`)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const autorizado = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(autorizado).pipe(catchError((error: HttpErrorResponse) => {
    if (error.status !== 401) return throwError(() => error);
    // Otra peticion puede haber renovado mientras esta respuesta estaba en camino.
    const actual = auth.getToken();
    const sesion = actual && actual !== token ? of({ token: actual }) : auth.refresh();
    return sesion.pipe(
      switchMap(({ token: nuevo }) => next(req.clone({ setHeaders: { Authorization: `Bearer ${nuevo}` } }))),
      catchError((fallo: HttpErrorResponse) => {
        if (fallo.status === 401) {
          auth.clearSession();
          void router.navigateByUrl('/login');
        }
        return throwError(() => fallo);
      }),
    );
  }));
};
