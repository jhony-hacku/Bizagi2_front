import { Observable } from 'rxjs';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/organizacion.service';
import { RolAcceso } from '../../core/models/auth.model';
import { Usuario } from '../../core/models/organizacion.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';

// HU-02: gestión de usuarios de la empresa
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule, AppHeaderComponent],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usuarioService = inject(UsuarioService);
  private readonly authService = inject(AuthService);

  protected readonly yo = this.authService.currentUser;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly loading = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly okMessage = signal<string | null>(null);
  protected readonly formAbierto = signal(false);
  protected readonly editando = signal<Usuario | null>(null);

  protected readonly roles: { valor: RolAcceso; etiqueta: string }[] = [
    { valor: 'ADMINISTRADOR', etiqueta: 'Administrador' },
    { valor: 'EDITOR', etiqueta: 'Editor' },
    { valor: 'LECTOR', etiqueta: 'Solo lectura' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    rolAcceso: ['EDITOR' as RolAcceso, Validators.required],
  });

  constructor() {
    this.cargar();
  }

  protected etiquetaRol(rol: RolAcceso): string {
    return this.roles.find((r) => r.valor === rol)?.etiqueta ?? rol;
  }

  protected cargar(): void {
    this.loading.set(true);
    this.usuarioService.listar().subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudieron cargar los usuarios.'));
      },
    });
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', email: '', password: '', rolAcceso: 'EDITOR' });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.formAbierto.set(true);
    this.limpiarMensajes();
  }

  protected editar(usuario: Usuario): void {
    this.editando.set(usuario);
    this.form.reset({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rolAcceso: usuario.rolAcceso,
    });
    this.form.controls.password.setValidators([Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.formAbierto.set(true);
    this.limpiarMensajes();
  }

  protected cancelar(): void {
    this.formAbierto.set(false);
    this.editando.set(null);
  }

  protected guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre, email, password, rolAcceso } = this.form.getRawValue();
    const actual = this.editando();
    this.guardando.set(true);
    this.limpiarMensajes();

    const peticion: Observable<unknown> = actual
      ? this.usuarioService.actualizar(actual.id, {
          nombre,
          email,
          rolAcceso,
          ...(password ? { password } : {}),
        })
      : this.usuarioService.crear({ nombre, email, password, rolAcceso });

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.formAbierto.set(false);
        this.editando.set(null);
        this.okMessage.set(actual ? 'Usuario actualizado.' : `Cuenta creada para ${email}.`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo guardar el usuario.'));
      },
    });
  }

  protected alternarActivo(usuario: Usuario): void {
    if (usuario.activo && !confirm(`¿Desactivar a ${usuario.nombre}? Su historial de cambios se conserva.`)) {
      return;
    }
    this.limpiarMensajes();
    const peticion: Observable<unknown> = usuario.activo
      ? this.usuarioService.desactivar(usuario.id)
      : this.usuarioService.activar(usuario.id);
    peticion.subscribe({
      next: () => this.cargar(),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(errorMessage(err, 'No se pudo cambiar el estado del usuario.')),
    });
  }

  private limpiarMensajes(): void {
    this.errorMessage.set(null);
    this.okMessage.set(null);
  }
}
