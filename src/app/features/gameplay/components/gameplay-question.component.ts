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
      const cardHoverBorders = [
        'hover:border-rose-300 hover:bg-rose-50/20',
        'hover:border-sky-300 hover:bg-sky-50/20',
        'hover:border-amber-300 hover:bg-amber-50/20',
        'hover:border-emerald-300 hover:bg-emerald-50/20',
        'hover:border-purple-300 hover:bg-purple-50/20',
        'hover:border-pink-300 hover:bg-pink-50/20',
      ];
      const hover = cardHoverBorders[optIdx % cardHoverBorders.length];
      return `bg-white border-[#e8e6e0] ${hover} text-slate-900`;
    }

    const isCorrect = optIdx === this.currentQuestion()?.correctOptionIndex;
    const isSelected = this.lastOutcome()?.selectedOptionIndex === optIdx;

    if (isCorrect) {
      return 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/40 shadow-xs';
    } else if (isSelected) {
      return 'bg-red-50 border-red-500 text-red-950 ring-2 ring-red-500/40 shadow-xs';
    } else {
      return 'bg-slate-50/60 border-[#e8e6e0] text-slate-400 opacity-40';
    }
  }

  getOptionBadgeClass(optIdx: number): string {
    if (!this.isAnswerSubmitted()) {
      const bullets = [
        'bg-rose-500 text-white shadow-xs shadow-rose-500/30',
        'bg-sky-500 text-white shadow-xs shadow-sky-500/30',
        'bg-amber-500 text-white shadow-xs shadow-amber-500/30',
        'bg-emerald-500 text-white shadow-xs shadow-emerald-500/30',
        'bg-purple-500 text-white shadow-xs shadow-purple-500/30',
        'bg-pink-500 text-white shadow-xs shadow-pink-500/30',
      ];
      return bullets[optIdx % bullets.length];
    }

    const isCorrect = optIdx === this.currentQuestion()?.correctOptionIndex;
    const isSelected = this.lastOutcome()?.selectedOptionIndex === optIdx;

    if (isCorrect) {
      return 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-white';
    } else if (isSelected) {
      return 'bg-red-600 text-white shadow-md shadow-red-600/30 ring-2 ring-white';
    } else {
      return 'bg-slate-200 text-slate-400';
    }
  }

  teacherSelectAnswer(optionIndex: number): void {
    if (this.isAnswerSubmitted()) return;

    if (!this.selectedTeamId()) {
      Swal.fire({
        icon: 'info',
        title: this.i18n.t('gameplay.step1Title'),
        text: this.i18n.t('gameplay.selectTeamFirst'),
        confirmButtonColor: '#0b6c62',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
      return;
    }

    this.gameplay.submitAnswer(optionIndex);
  }

  submitTextAnswer(teacherOverride?: boolean): void {
    if (this.isAnswerSubmitted()) return;

    if (!this.selectedTeamId()) {
      Swal.fire({
        icon: 'info',
        title: this.i18n.t('gameplay.step1Title'),
        text: this.i18n.t('gameplay.selectTeamFirst'),
        confirmButtonColor: '#0b6c62',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
      return;
    }

    const answer = this.studentTextAnswer.trim() || (teacherOverride ? '✓ Teacher Accepted' : '');
    if (!answer && teacherOverride === undefined) return;

    this.gameplay.submitTextAnswer(answer, teacherOverride);
    this.studentTextAnswer = '';
  }

  submitVerdict(isCorrect: boolean): void {
    if (this.isAnswerSubmitted()) return;

    if (!this.selectedTeamId()) {
      Swal.fire({
        icon: 'info',
        title: this.i18n.t('gameplay.step1Title'),
        text: this.i18n.t('gameplay.selectTeamFirst'),
        confirmButtonColor: '#0b6c62',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
      return;
    }

    this.gameplay.submitVerdict(isCorrect, -1, this.studentTextAnswer.trim());
    this.studentTextAnswer = '';
  }

  overrideOutcome(newIsCorrect: boolean): void {
    const outcome = this.gameplay.overrideLastOutcome(newIsCorrect);
    if (outcome) {
      Swal.fire({
        icon: newIsCorrect ? 'success' : 'warning',
        title: this.i18n.t('gameplay.outcomeOverridden', {
          status: newIsCorrect ? this.i18n.t('gameplay.correct') : this.i18n.t('gameplay.wrongBanner')
        }),
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
    }
  }
}
