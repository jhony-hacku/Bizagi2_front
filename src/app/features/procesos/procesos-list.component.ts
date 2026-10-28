import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProcesoService } from '../../core/services/proceso.service';
import { PageInfo, Proceso } from '../../core/models/proceso.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-procesos-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AppHeaderComponent],
  templateUrl: './procesos-list.component.html',
  styleUrl: './procesos-list.component.css',
})
export class ProcesosListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly procesoService = inject(ProcesoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);

  protected readonly puedeEscribir = this.authService.puedeEscribir;
  protected readonly esAdministrador = this.authService.esAdministrador;

  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly pageInfo = signal<PageInfo>({ size: PAGE_SIZE, number: 0, totalElements: 0, totalPages: 0 });
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly filtros = this.fb.nonNullable.group({
    nombre: [''],
    estado: ['' as '' | 'BORRADOR' | 'PUBLICADO'],
    categoria: [''],
    verEliminados: [false],
  });

  constructor() {
    this.filtros.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar(0));
    this.cargar(0);
  }

  protected cargar(page: number): void {
    const { nombre, estado, categoria, verEliminados } = this.filtros.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.procesoService
      .listar({ nombre, estado, categoria, activo: !verEliminados, page, size: PAGE_SIZE })
      .subscribe({
        next: (respuesta) => {
          this.procesos.set(respuesta.content);
          this.pageInfo.set(respuesta.page);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(errorMessage(err, 'No se pudieron cargar los procesos.'));
        },
      });
  }

  protected eliminar(proceso: Proceso): void {
    if (!confirm(`¿Eliminar el proceso "${proceso.nombre}"? Quedará inactivo y podrás consultarlo con el filtro "Ver eliminados".`)) {
      return;
    }
    this.procesoService.eliminar(proceso.id).subscribe({
      next: () => this.cargar(this.pageInfo().number),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(errorMessage(err, 'No se pudo eliminar el proceso.')),
    });
  }
}
