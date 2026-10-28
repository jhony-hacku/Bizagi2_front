import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ProcesoService } from '../../core/services/proceso.service';
import { errorMessage } from '../../core/utils/http-error';
import { AppHeaderComponent } from '../../shared/app-header/app-header.component';

@Component({
  selector: 'app-proceso-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AppHeaderComponent],
  templateUrl: './proceso-form.component.html',
  styleUrl: './proceso-form.component.css',
})
export class ProcesoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly procesoService = inject(ProcesoService);
  private readonly router = inject(Router);

  // Viene del parámetro :id de la ruta; sin valor es una creación
  readonly id = input<string>();

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: [''],
    categoria: [''],
    estado: ['BORRADOR' as 'BORRADOR' | 'PUBLICADO'],
  });

  protected get editando(): boolean {
    return this.id() !== undefined;
  }

  ngOnInit(): void {
    const id = this.id();
    if (id === undefined) return;

    this.loading.set(true);
    this.procesoService.buscar(Number(id)).subscribe({
      next: (proceso) => {
        this.form.patchValue({
          nombre: proceso.nombre,
          descripcion: proceso.descripcion ?? '',
          categoria: proceso.categoria ?? '',
          estado: proceso.estado,
        });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo cargar el proceso.'));
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombre, descripcion, categoria, estado } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    const id = this.id();
    const peticion =
      id === undefined
        ? this.procesoService.crear({ nombre, descripcion, categoria })
        : this.procesoService.actualizar(Number(id), { nombre, descripcion, categoria, estado });

    peticion.subscribe({
      next: () => this.router.navigateByUrl('/procesos'),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(errorMessage(err, 'No se pudo guardar el proceso. Intenta de nuevo más tarde.'));
      },
    });
  }
}
