import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/services/i18n.service';
import { GameplayService } from '../../../core/services/gameplay.service';
import { PowerCardType } from '../../../core/models/power-card.model';
import { formatTimer } from '../../../core/utils';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gameplay-question',
  imports: [FormsModule],
  templateUrl: './gameplay-question.component.html',
  styleUrl: './gameplay-question.component.css'
})
export class GameplayQuestionComponent {
  readonly i18n = inject(I18nService);
  private gameplay = inject(GameplayService);

  studentTextAnswer = '';

  readonly currentQuestion = this.gameplay.currentQuestion;
  readonly timerRemaining = this.gameplay.timerService.remainingSeconds;
  readonly timerTotalSeconds = this.gameplay.timerService.totalSeconds;
  readonly activeCard = this.gameplay.activeCard;
  readonly lastOutcome = this.gameplay.lastOutcome;
  readonly isAnswerSubmitted = this.gameplay.isAnswerSubmitted;
  readonly isLastQuestion = this.gameplay.isLastQuestion;
  readonly selectedTeamId = this.gameplay.selectedTeamId;

  readonly timerProgress = computed(() => {
    const total = this.timerTotalSeconds();
    const remaining = this.timerRemaining();
    if (total <= 0) return 0;
    return (remaining / total) * 100;
  });

  formatTime(seconds: number): string {
    return formatTimer(seconds);
  }

  getCardLabel(cardType: PowerCardType): string {
    switch (cardType) {
      case 'double_points': return this.i18n.t('gameplay.cardDouble');
      case 'steal_points': return this.i18n.t('gameplay.cardSteal');
      case 'extra_time': return this.i18n.t('gameplay.cardExtraTime');
    }
  }

  getOptionCardClass(optIdx: number): string {
    if (!this.isAnswerSubmitted()) {
      return 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-white text-slate-700';
    }

    const isCorrect = optIdx === this.currentQuestion()?.correctOptionIndex;
    const isSelected = this.lastOutcome()?.selectedOptionIndex === optIdx;

    if (isCorrect) {
      return 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-400/50';
    } else if (isSelected) {
      return 'bg-red-50 border-red-400 text-red-900 ring-2 ring-red-400/50';
    } else {
      return 'bg-slate-50/50 border-slate-200 text-slate-400 opacity-60';
    }
  }

  getOptionBadgeClass(optIdx: number): string {
    if (!this.isAnswerSubmitted()) {
      return 'bg-slate-200 text-slate-600';
    }

    const isCorrect = optIdx === this.currentQuestion()?.correctOptionIndex;
    const isSelected = this.lastOutcome()?.selectedOptionIndex === optIdx;

    if (isCorrect) {
      return 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30';
    } else if (isSelected) {
      return 'bg-red-500 text-white shadow-md shadow-red-500/30';
    } else {
      return 'bg-slate-200 text-slate-500';
    }
  }

  teacherSelectAnswer(optionIndex: number): void {
    if (this.isAnswerSubmitted()) return;

    if (!this.selectedTeamId()) {
      Swal.fire({
        icon: 'info',
        title: this.i18n.t('gameplay.step1Title'),
        text: this.i18n.t('gameplay.selectTeamFirst'),
        confirmButtonColor: '#4f46e5',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
      return;
    }

    this.gameplay.submitAnswer(optionIndex);
  }

  submitTextAnswer(): void {
    if (this.isAnswerSubmitted()) return;

    if (!this.selectedTeamId()) {
      Swal.fire({
        icon: 'info',
        title: this.i18n.t('gameplay.step1Title'),
        text: this.i18n.t('gameplay.selectTeamFirst'),
        confirmButtonColor: '#4f46e5',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
      return;
    }

    if (!this.studentTextAnswer.trim()) return;

    this.gameplay.submitTextAnswer(this.studentTextAnswer);
    this.studentTextAnswer = '';
  }
}
