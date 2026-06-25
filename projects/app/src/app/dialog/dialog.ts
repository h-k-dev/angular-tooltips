import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { AngularTooltip } from '../../../../angular-tooltips/src/public-api';
@Component({
  selector: 'settings-dialog',
  imports: [MatDialogModule, AngularTooltip],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
})
export class Dialog {}
