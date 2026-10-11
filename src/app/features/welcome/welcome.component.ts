import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SeedService } from '../../core/services/seed.service';
import { ClassService } from '../../core/services/class.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';

@Component({
  selector: 'app-welcome',
  imports: [LanguageSwitcherComponent],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private seedService = inject(SeedService);
  private classService = inject(ClassService);

  enter(): void {
    this.router.navigate(['/classes']);
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  loadDemoClass(): void {
    const demo = this.seedService.seedDemoClassroom();
    this.classService.refreshClasses();
    this.router.navigate(['/classes', demo.id]);
  }
}
