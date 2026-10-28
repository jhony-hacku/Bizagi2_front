import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RolProcesoService } from '../../core/services/organizacion.service';
import { RolProcesoDetalle } from '../../core/models/organizacion.model';
import { HistorialEntry, PageInfo } from '../../core/models/proceso.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';

const PAGE_SIZE = 10;

// HU-17 a HU-20: catálogo de roles de proceso
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, AppHeaderComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css',
})
export class RolesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rolService = inject(RolProcesoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);

  protected readonly puedeEscribir = this.authService.puedeEscribir;
  protected readonly esAdministrador = this.authService.esAdministrador;

  protected readonly roles = signal<RolProcesoDetalle[]>([]);
  protected readonly pageInfo = signal<PageInfo>({ size: PAGE_SIZE, number: 0, totalElements: 0, totalPages: 0 });
  protected readonly loading = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly okMessage = signal<string | null>(null);
  protected readonly formAbierto = signal(false);
  protected readonly editando = signal<RolProcesoDetalle | null>(null);
  protected readonly expandido = signal<number | null>(null);
  protected readonly historial = signal<HistorialEntry[]>([]);
  protected readonly historialRol = signal<RolProcesoDetalle | null>(null);

  protected readonly busqueda = this.fb.nonNullable.control('');
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: [''],
  });

  constructor() {
    this.busqueda.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar(0));
    this.cargar(0);
  }

  protected cargar(page: number): void {
    this.loading.set(true);
    this.rolService.listar(this.busqueda.value, page, PAGE_SIZE).subscribe({
      next: (respuesta) => {
        this.roles.set(respuesta.content);
        this.pageInfo.set(respuesta.page);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudieron cargar los roles.'));
      },
    });
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', descripcion: '' });
    this.formAbierto.set(true);
    this.limpiarMensajes();
  }

  protected editar(rol: RolProcesoDetalle): void {
    this.editando.set(rol);
    this.form.reset({ nombre: rol.nombre, descripcion: rol.descripcion ?? '' });
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
    const datos = this.form.getRawValue();
    const actual = this.editando();
    this.guardando.set(true);
    this.limpiarMensajes();

    const peticion = actual ? this.rolService.actualizar(actual.id, datos) : this.rolService.crear(datos);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.formAbierto.set(false);
        this.editando.set(null);
        this.okMessage.set(actual ? 'Rol actualizado.' : 'Rol creado.');
        this.cargar(this.pageInfo().number);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo guardar el rol.'));
      },
    });
  }

  protected eliminar(rol: RolProcesoDetalle): void {
    if (!rol.eliminable) {
      const procesos = rol.procesos.map((p) => p.nombre).join(', ');
      this.errorMessage.set(`El rol "${rol.nombre}" está en uso en: ${procesos}. Reasigna sus lanes antes de eliminarlo.`);
      return;
    }
    if (!confirm(`¿Eliminar el rol "${rol.nombre}"? Quedará inactivo y se conserva su historial.`)) {
      return;
    }
    this.limpiarMensajes();
    this.rolService.eliminar(rol.id).subscribe({
      next: () => {
        this.okMessage.set('Rol eliminado.');
        this.cargar(this.pageInfo().number);
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(errorMessage(err, 'No se pudo eliminar el rol.')),
    });
  }

  protected alternarProcesos(rol: RolProcesoDetalle): void {
    this.expandido.set(this.expandido() === rol.id ? null : rol.id);
  }

  protected verHistorial(rol: RolProcesoDetalle): void {
    if (this.historialRol()?.id === rol.id) {
      this.historialRol.set(null);
      return;
    }
    this.historialRol.set(rol);
    this.historial.set([]);
    this.rolService.historial(rol.id).subscribe({
      next: (lista) => this.historial.set(lista),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(errorMessage(err, 'No se pudo cargar el historial del rol.')),
    });
  }

  private limpiarMensajes(): void {
    this.errorMessage.set(null);
    this.okMessage.set(null);
  }
}
