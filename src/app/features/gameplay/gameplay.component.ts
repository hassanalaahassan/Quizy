import { Component, computed, inject, input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { GameplayService } from '../../core/services/gameplay.service';
import { ClassService } from '../../core/services/class.service';
import { I18nService } from '../../core/services/i18n.service';
import { GameplayHeaderComponent } from './components/gameplay-header.component';
import { GameplayQuestionComponent } from './components/gameplay-question.component';
import { GameplayControlsComponent } from './components/gameplay-controls.component';

@Component({
  selector: 'app-gameplay',
  imports: [
    GameplayHeaderComponent,
    GameplayQuestionComponent,
    GameplayControlsComponent
  ],
  templateUrl: './gameplay.component.html',
  styleUrl: './gameplay.component.css',
})
export class GameplayComponent implements OnInit, OnDestroy {
  classId = input.required<string>();
  sessionId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private gameplay = inject(GameplayService);
  private classService = inject(ClassService);
  private confirmationService = inject(ConfirmationService);

  readonly currentQuestion = this.gameplay.currentQuestion;
  readonly isLastQuestion = this.gameplay.isLastQuestion;

  ngOnInit(): void {
    this.classService.selectClass(this.classId());
    const success = this.gameplay.initSession(this.classId(), this.sessionId());
    if (!success) {
      this.router.navigate(['/classes', this.classId()]);
    }
  }

  ngOnDestroy(): void {
    this.gameplay.timerService.stop();
  }

  nextQuestion(): void {
    if (this.isLastQuestion()) {
      this.gameplay.completeSession();
      this.router.navigate(['/classes', this.classId(), 'sessions', this.sessionId(), 'results']);
    } else {
      this.gameplay.nextQuestion();
    }
  }

  confirmSkipQuestion(): void {
    this.confirmationService.confirm({
      header: this.i18n.t('gameplay.skipConfirmTitle'),
      message: this.i18n.t('gameplay.skipConfirmMessage'),
      icon: 'pi pi-forward text-amber-500 text-xl',
      acceptLabel: this.i18n.t('common.yes'),
      rejectLabel: this.i18n.t('common.no'),
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.gameplay.skipQuestion();
      },
    });
  }

  confirmPauseAndExit(): void {
    this.confirmationService.confirm({
      header: this.i18n.t('gameplay.pauseExitConfirmTitle'),
      message: this.i18n.t('gameplay.pauseExitConfirmMessage'),
      icon: 'pi pi-pause-circle text-amber-500 text-xl',
      acceptLabel: this.i18n.t('common.yes'),
      rejectLabel: this.i18n.t('common.no'),
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.gameplay.pauseAndSaveSession();
        this.router.navigate(['/classes', this.classId()]);
      },
    });
  }
}
