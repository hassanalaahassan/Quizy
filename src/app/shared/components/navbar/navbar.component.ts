import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { LanguageSwitcherComponent } from '../language-switcher.component';

export interface NavAction {
  label: string;
  icon: string;
  route?: string;
  callback?: () => void;
  style?: 'primary' | 'secondary' | 'ghost';
  hideOnMobile?: boolean;
  badge?: string;
}

@Component({
  selector: 'app-navbar',
  imports: [LanguageSwitcherComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);

  /** Show a back button instead of the logo */
  showBack = input(false);
  /** Custom back route (defaults to '/' or browser back) */
  backRoute = input<string>('');
  /** Title override (replaces "Quiziyyy" on subpages) */
  pageTitle = input('');
  /** Subtitle / breadcrumb below the title */
  pageSubtitle = input('');
  /** Badge next to the title */
  pageBadge = input('');
  /** Right-side action buttons */
  actions = input<NavAction[]>([]);
  /** Show the brand logo */
  showBrand = input(true);

  mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  goBack(): void {
    const route = this.backRoute();
    if (route) {
      this.router.navigate([route]);
    } else {
      window.history.back();
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  executeAction(action: NavAction): void {
    this.mobileMenuOpen.set(false);
    if (action.callback) {
      action.callback();
    } else if (action.route) {
      this.router.navigate([action.route]);
    }
  }
}
