import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ClassService } from '../../core/services/class.service';
import { SeedService } from '../../core/services/seed.service';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { I18nService } from '../../core/services/i18n.service';
import { GameClass } from '../../core/models/game-class.model';
import { NavbarComponent, NavAction } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-class-list',
  imports: [FormsModule, NavbarComponent],
  templateUrl: './class-list.component.html',
  styleUrl: './class-list.component.css',
})
export class ClassListComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private seedService = inject(SeedService);
  private bankService = inject(QuestionBankService);
  private confirmationService = inject(ConfirmationService);

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

  readonly classes = this.classService.classes;
  readonly groups = this.bankService.groups;

  readonly classCardStats = computed(() => {
    return this.classes().map(c => ({
      classData: c,
      stats: this.classService.getClassStats(c.id),
    }));
  });

  readonly showCreateModal = signal(false);
  readonly errorMessage = signal('');
  newClassName = '';
  newClassGroupId = '';

  readonly presets = ['Grade 3A', 'Grade 3B', 'Grade 4A', 'Grade 5B', 'Grade 7A', 'Science Club'];

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  goToQuestionBank(): void {
    this.router.navigate(['/question-bank']);
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
    const grps = this.groups();
    this.newClassGroupId = grps.length > 0 ? grps[0].id : '';
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
      const created = this.classService.createClass(trimmed, this.newClassGroupId);
      this.closeCreateModal();
      this.openClass(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating class';
      this.errorMessage.set(msg);
    }
  }

  getGroupName(groupId?: string): string {
    if (!groupId) return '';
    return this.groups().find(g => g.id === groupId)?.name || '';
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
