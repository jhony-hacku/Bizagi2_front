import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { EmpresaService } from '../../core/services/organizacion.service';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';
import { NotificacionService } from '../../core/services/notificacion.service';

// HU-01 y HU-24: datos de la empresa y permisos sobre la estructura de pools y lanes
@Component({
  selector: 'app-empresa',
  standalone: true,
  imports: [ReactiveFormsModule, AppHeaderComponent],
  templateUrl: './empresa.component.html',
})
export class EmpresaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly notificaciones = inject(NotificacionService);
  private readonly empresaService = inject(EmpresaService);

  protected readonly esAdministrador = inject(AuthService).esAdministrador;
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    nit: ['', Validators.required],
    emailContacto: ['', [Validators.required, Validators.email]],
    editorModificaEstructura: [true],
  });

  constructor() {
    this.empresaService.obtener().subscribe({
      next: (empresa) => {
        this.form.reset({
          nombre: empresa.nombre,
          nit: empresa.nit,
          emailContacto: empresa.emailContacto,
          editorModificaEstructura: empresa.editorModificaEstructura !== false,
        });
        if (!this.esAdministrador()) this.form.disable();
      },
      error: (err: HttpErrorResponse) =>
        this.notificaciones.error(errorMessage(err, 'No se pudieron cargar los datos de la empresa.')),
    });
  }

  protected guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);

    this.empresaService.actualizar(this.form.getRawValue()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notificaciones.ok('Datos de la empresa actualizados.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.notificaciones.error(errorMessage(err, 'No se pudieron guardar los cambios.'));
      },
    });
  }
}
