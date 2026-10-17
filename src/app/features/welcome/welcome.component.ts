import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SeedService } from '../../core/services/seed.service';
import { ClassService } from '../../core/services/class.service';
import { NavbarComponent, NavAction } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-welcome',
  imports: [NavbarComponent],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private seedService = inject(SeedService);
  private classService = inject(ClassService);

  readonly navActions = computed<NavAction[]>(() => [
    {
      label: this.i18n.t('bank.navTitle'),
      icon: 'pi pi-database',
      route: '/question-bank',
      style: 'secondary',
    },
    {
      label: this.i18n.t('nav.howToPlay'),
      icon: 'pi pi-info-circle',
      route: '/instructions',
      style: 'ghost',
    },
    {
      label: this.i18n.t('nav.rules'),
      icon: 'pi pi-book',
      route: '/rules',
      style: 'ghost',
    },
  ]);

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
