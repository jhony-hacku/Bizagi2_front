import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RolAcceso } from '../../core/models/auth.model';

const ETIQUETA_ROL: Record<RolAcceso, string> = {
  ADMINISTRADOR: 'Administrador',
  EDITOR: 'Editor',
  LECTOR: 'Solo lectura',
};

// Panel de perfil (arriba a la derecha): datos de la sesión y cierre de sesión
@Component({
  selector: 'app-perfil-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './perfil-menu.component.html',
  styleUrl: './perfil-menu.component.css',
})
export class PerfilMenuComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly usuario = this.authService.currentUser;
  protected readonly esAdministrador = this.authService.esAdministrador;
  protected readonly abierto = signal(false);
  protected readonly cerrando = signal(false);
  protected readonly rol = computed(() => {
    const rol = this.usuario()?.rolAcceso;
    return rol ? ETIQUETA_ROL[rol] : '';
  });

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected cerrarSesion(): void {
    if (this.cerrando()) return;
    this.cerrando.set(true);
    this.authService.logout().subscribe(() => {
      this.abierto.set(false);
      this.cerrando.set(false);
      this.router.navigateByUrl('/login');
    });
  }

  @HostListener('document:click', ['$event'])
  protected alHacerClic(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.abierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected alPresionarEscape(): void {
    this.abierto.set(false);
  }
}
