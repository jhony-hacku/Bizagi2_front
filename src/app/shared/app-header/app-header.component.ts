import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PerfilMenuComponent } from '../perfil-menu/perfil-menu.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, PerfilMenuComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css',
})
export class AppHeaderComponent {
  private readonly authService = inject(AuthService);

  protected readonly usuario = this.authService.currentUser;
  protected readonly esAdministrador = this.authService.esAdministrador;
}
