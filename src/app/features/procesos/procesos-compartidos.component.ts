import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DiagramaService } from '../../core/services/diagrama.service';
import { ProcesoCompartido } from '../../core/models/diagrama.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';
import { NotificacionService } from '../../core/services/notificacion.service';

// HU-23: procesos que otras empresas compartieron, en solo lectura
@Component({
  selector: 'app-procesos-compartidos',
  standalone: true,
  imports: [DatePipe, RouterLink, AppHeaderComponent],
  templateUrl: './procesos-compartidos.component.html',
})
export class ProcesosCompartidosComponent {
  private readonly diagramaService = inject(DiagramaService);
  private readonly notificaciones = inject(NotificacionService);

  protected readonly procesos = signal<ProcesoCompartido[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.diagramaService.compartidosConmigo().subscribe({
      next: (lista) => {
        this.procesos.set(lista);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.notificaciones.error(errorMessage(err, 'No se pudieron cargar los procesos compartidos.'));
      },
    });
  }
}
