import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorResponse } from '../models/auth.model';

interface ValidationErrorBody extends ApiErrorResponse {
  errores?: Record<string, string>;
}

// Mensaje para mostrar al usuario: el del backend en errores 400/403/404/409, genérico en el resto
export function errorMessage(err: HttpErrorResponse, fallback: string): string {
  const body = err.error as ValidationErrorBody | null;
  if (![400, 403, 404, 409].includes(err.status) || !body) {
    return fallback;
  }
  const firstFieldError = body.errores ? Object.values(body.errores)[0] : undefined;
  return firstFieldError ?? body.message ?? fallback;
}
