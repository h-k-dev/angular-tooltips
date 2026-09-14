import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  HkJsTooltip,
  HkTooltip,
  TooltipPlacement,
} from '../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'login-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, HkTooltip, HkJsTooltip],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
})
export class Dialog {
  // One group per placement — each group anchors a <button> and an <a href>
  // (invoker engine) plus a <span> (JS engine), so both engines are
  // exercised in every direction inside the top layer.
  placements: TooltipPlacement[] = ['top', 'right', 'bottom', 'left'];
}
