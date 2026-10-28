import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorResponse } from '../../core/models/auth.model';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-register-company',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-company.component.html',
  styleUrl: './register-company.component.css',
})
export class RegisterCompanyComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      nombreEmpresa: ['', [Validators.required]],
      nit: ['', [Validators.required]],
      emailContacto: ['', [Validators.required, Validators.email]],
      nombre: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { nombreEmpresa, nit, emailContacto, nombre, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService
      .registerCompany({ nombreEmpresa, nit, emailContacto, nombre, email, password })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('Empresa registrada correctamente. Ya puedes iniciar sesión.');
          this.form.reset();
          setTimeout(() => this.router.navigateByUrl('/login'), 1500);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const apiError = err.error as ApiErrorResponse | undefined;
          const esErrorDeUsuario = err.status === 400 || err.status === 409;
          this.errorMessage.set(
            esErrorDeUsuario && apiError?.message
              ? apiError.message
              : 'No se pudo registrar la empresa. Intenta de nuevo más tarde.',
          );
        },
      });
  }
}
