import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AngularTooltip, TooltipPlacement } from '../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'login-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, AngularTooltip],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
})
export class Dialog {
  // One group per placement — each group anchors a <button>, <a>, <span>
  // and <div> so every element type is exercised in every direction.
  placements: TooltipPlacement[] = ['top', 'right', 'bottom', 'left'];
}
