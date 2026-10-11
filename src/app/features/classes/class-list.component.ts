import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ClassService } from '../../core/services/class.service';
import { SeedService } from '../../core/services/seed.service';
import { I18nService } from '../../core/services/i18n.service';
import { GameClass } from '../../core/models/game-class.model';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';

@Component({
  selector: 'app-class-list',
  imports: [FormsModule, LanguageSwitcherComponent],
  templateUrl: './class-list.component.html',
  styleUrl: './class-list.component.css',
})
export class ClassListComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private seedService = inject(SeedService);
  private confirmationService = inject(ConfirmationService);

  readonly classes = this.classService.classes;

  readonly classCardStats = computed(() => {
    return this.classes().map(c => ({
      classData: c,
      stats: this.classService.getClassStats(c.id),
    }));
  });

  readonly showCreateModal = signal(false);
  readonly errorMessage = signal('');
  newClassName = '';

  readonly presets = ['Grade 3A', 'Grade 3B', 'Grade 4A', 'Grade 5B', 'Grade 7A', 'Science Club'];

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  openClass(classId: string): void {
    this.router.navigate(['/classes', classId]);
  }

  resumeSession(classId: string, sessionId: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/classes', classId, 'sessions', sessionId, 'play']);
  }

  openCreateModal(): void {
    this.newClassName = '';
    this.errorMessage.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.errorMessage.set('');
  }

  createClass(): void {
    const trimmed = this.newClassName.trim();
    if (!trimmed) {
      this.errorMessage.set('Please enter a classroom name');
      return;
    }

    try {
      const created = this.classService.createClass(trimmed);
      this.closeCreateModal();
      this.openClass(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating class';
      this.errorMessage.set(msg);
    }
  }

  confirmDelete(cls: GameClass, event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      header: this.i18n.t('classes.deleteConfirmTitle'),
      message: this.i18n.t('classes.deleteConfirmMessage', { name: cls.name }),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.classService.deleteClass(cls.id);
      },
    });
  }

  loadDemoClass(): void {
    const demo = this.seedService.seedDemoClassroom();
    this.classService.refreshClasses();
    this.openClass(demo.id);
  }

  formatDate(epochMs: number): string {
    const date = new Date(epochMs);
    return date.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
