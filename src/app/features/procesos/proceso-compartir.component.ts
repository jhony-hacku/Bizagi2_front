import { Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DiagramaService } from '../../core/services/diagrama.service';
import { ProcesoService } from '../../core/services/proceso.service';
import { EmpresaInvitada } from '../../core/models/diagrama.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import { NotificacionService } from '../../core/services/notificacion.service';

// HU-23: empresas con las que se comparte un proceso (solo lectura para ellas)
@Component({
  selector: 'app-proceso-compartir',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, RouterLink, AppHeaderComponent],
  templateUrl: './proceso-compartir.component.html',
})
export class ProcesoCompartirComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly notificaciones = inject(NotificacionService);
  private readonly diagramaService = inject(DiagramaService);
  private readonly procesoService = inject(ProcesoService);
  private readonly confirmacion = inject(ConfirmacionService);

  readonly id = input.required<string>();

  protected readonly nombreProceso = signal('');
  protected readonly invitadas = signal<EmpresaInvitada[]>([]);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nit: ['', Validators.required],
  });

  ngOnInit(): void {
    this.procesoService.buscar(Number(this.id())).subscribe({
      next: (proceso) => this.nombreProceso.set(proceso.nombre),
      error: (err: HttpErrorResponse) =>
        this.notificaciones.error(errorMessage(err, 'No se pudo cargar el proceso.')),
    });
    this.cargar();
  }

  protected compartir(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);

    this.diagramaService.compartir(Number(this.id()), this.form.getRawValue().nit.trim()).subscribe({
      next: (invitada) => {
        this.guardando.set(false);
        this.form.reset({ nit: '' });
        this.notificaciones.ok(`Proceso compartido con ${invitada.empresa}.`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.notificaciones.error(errorMessage(err, 'No se pudo compartir el proceso.'));
      },
    });
  }

  protected async dejarDeCompartir(invitada: EmpresaInvitada): Promise<void> {
    const aceptado = await this.confirmacion.pedir({
      titulo: 'Dejar de compartir',
      mensaje: `¿Dejar de compartir el proceso con ${invitada.empresa}?`,
      etiqueta: 'Dejar de compartir',
    });
    if (!aceptado) {
      return;
    }
    this.diagramaService.dejarDeCompartir(Number(this.id()), invitada.empresaId).subscribe({
      next: () => {
        this.notificaciones.ok(`Ya no se comparte con ${invitada.empresa}.`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) =>
        this.notificaciones.error(errorMessage(err, 'No se pudo dejar de compartir el proceso.')),
    });
  }

  private cargar(): void {
    this.diagramaService.invitadas(Number(this.id())).subscribe({
      next: (lista) => this.invitadas.set(lista),
      error: (err: HttpErrorResponse) =>
        this.notificaciones.error(errorMessage(err, 'No se pudo cargar la lista de empresas.')),
    });
  }
}
