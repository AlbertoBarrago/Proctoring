import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {CommonModule} from "@angular/common";
import {ProctoringComponent} from "./proctoring/proctoring.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ProctoringComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'proctoring-frontend';
}
