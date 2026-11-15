# Bizagi2 frontend

Angular 22.1. Requiere Node 24.15 o posterior compatible con Angular (`^22.22.3 || ^24.15.0 || >=26`).

```bash
npm ci
npm start
```

Abre http://localhost:4200. `proxy.conf.json` envia `/api` al backend en http://localhost:8080. Inicia el backend con el perfil dev para HTTP local. En produccion publica frontend y `/api` bajo el mismo origen con HTTPS.

## Sesion JWT

El access token vive en memoria y solo se envia a las rutas propias `/api/*`. El refresh se conserva exclusivamente en una cookie HttpOnly del backend. La aplicacion obtiene CSRF antes de las operaciones de sesion; Angular envia `X-XSRF-TOKEN` automaticamente.

Al iniciar o recargar, la aplicacion recupera la sesion mediante refresh antes de evaluar las rutas. Ante un 401 renueva una vez y reintenta; las peticiones concurrentes comparten la renovacion. Web Locks coordina las pestañas en navegadores modernos. Un 403 no dispara renovaciones. El logout conserva la sesion local si falla la conexion, para permitir reintentar.

```bash
npm run build
npm test -- --watch=false
```

Las pruebas HTTP simuladas cubren el token en memoria, recuperacion al recargar, 401 concurrentes, permisos, peticiones a terceros y cierre de sesion. Las decisiones de permisos reales siempre las toma el backend.
