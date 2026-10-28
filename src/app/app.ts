import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { NotificacionesComponent } from './shared/notificaciones/notificaciones.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, NotificacionesComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
