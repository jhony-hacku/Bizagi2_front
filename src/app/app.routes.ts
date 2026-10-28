import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register-company',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/register-company/register-company.component').then(
        (m) => m.RegisterCompanyComponent,
      ),
  },
  {
    path: 'procesos',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/procesos/procesos-list.component').then((m) => m.ProcesosListComponent),
      },
      {
        path: 'compartidos',
        loadComponent: () =>
          import('./features/procesos/procesos-compartidos.component').then(
            (m) => m.ProcesosCompartidosComponent,
          ),
      },
      {
        path: ':id/compartir',
        loadComponent: () =>
          import('./features/procesos/proceso-compartir.component').then(
            (m) => m.ProcesoCompartirComponent,
          ),
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./features/procesos/proceso-form.component').then((m) => m.ProcesoFormComponent),
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import('./features/procesos/proceso-form.component').then((m) => m.ProcesoFormComponent),
      },
      {
        path: ':id/historial',
        loadComponent: () =>
          import('./features/procesos/proceso-historial.component').then(
            (m) => m.ProcesoHistorialComponent,
          ),
      },
      {
        path: ':id/editor',
        loadComponent: () =>
          import('./features/editor/bpmn-editor.component').then((m) => m.BpmnEditorComponent),
      },
    ],
  },
  {
    path: 'roles',
    canActivate: [authGuard],
    loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent),
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
  },
  {
    path: 'empresa',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/empresa/empresa.component').then((m) => m.EmpresaComponent),
  },
  { path: '**', redirectTo: 'login' },
];
