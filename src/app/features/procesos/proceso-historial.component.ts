import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ProcesoService } from '../../core/services/proceso.service';
import { HistorialEntry, Proceso } from '../../core/models/proceso.model';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';

@Component({
  selector: 'app-proceso-historial',
  standalone: true,
  imports: [DatePipe, RouterLink, AppHeaderComponent],
  templateUrl: './proceso-historial.component.html',
  styleUrl: './proceso-historial.component.css',
})
export class ProcesoHistorialComponent implements OnInit {
  private readonly procesoService = inject(ProcesoService);

  readonly id = input.required<string>();

  protected readonly proceso = signal<Proceso | null>(null);
  protected readonly entradas = signal<HistorialEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.id());

    this.procesoService.buscar(id).subscribe({
      next: (proceso) => this.proceso.set(proceso),
      error: (err: HttpErrorResponse) =>
        this.errorMessage.set(errorMessage(err, 'No se pudo cargar el proceso.')),
    });

    this.procesoService.historial(id).subscribe({
      next: (entradas) => {
        this.entradas.set(entradas);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo cargar el historial.'));
      },
    });
  }
}
