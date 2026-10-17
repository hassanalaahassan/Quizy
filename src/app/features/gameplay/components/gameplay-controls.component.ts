import { Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/services/i18n.service';
import { GameplayService } from '../../../core/services/gameplay.service';
import { GreenCardService } from '../../../core/services/green-card.service';
import { PowerCard, PowerCardType } from '../../../core/models/power-card.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-gameplay-controls',
  imports: [FormsModule],
  templateUrl: './gameplay-controls.component.html',
  styleUrl: './gameplay-controls.component.css'
})
export class GameplayControlsComponent {
  readonly i18n = inject(I18nService);
  private gameplay = inject(GameplayService);
  private greenCardService = inject(GreenCardService);

  readonly teams = this.gameplay.teams;
  readonly rankedTeams = this.gameplay.rankedTeams;
  readonly selectedTeamId = this.gameplay.selectedTeamId;
  readonly selectedTeam = this.gameplay.selectedTeam;
  readonly isAnswerSubmitted = this.gameplay.isAnswerSubmitted;
  readonly activeCard = this.gameplay.activeCard;
  readonly session = this.gameplay.session;

  readonly adjustingTeam = computed(() => {
    const tid = this.gameplay.adjustingTeamId();
    if (!tid) return null;
    return this.teams().find(t => t.id === tid) ?? null;
  });

  customDeltaValue: number | null = null;
  customExactScore: number | null = null;

  onSkipQuestion = output<void>();

  getTeamColor(index: number) {
    const palette = [
      { bullet: 'bg-rose-500', selectedBg: 'bg-rose-600', ring: 'ring-rose-400' },
      { bullet: 'bg-sky-500', selectedBg: 'bg-sky-600', ring: 'ring-sky-400' },
      { bullet: 'bg-amber-500', selectedBg: 'bg-amber-600', ring: 'ring-amber-400' },
      { bullet: 'bg-emerald-500', selectedBg: 'bg-emerald-600', ring: 'ring-emerald-400' },
      { bullet: 'bg-purple-500', selectedBg: 'bg-purple-600', ring: 'ring-purple-400' },
      { bullet: 'bg-teal-500', selectedBg: 'bg-teal-600', ring: 'ring-teal-400' },
    ];
    return palette[index % palette.length];
  }

  openAdjustScoreModal(teamId?: string): void {
    this.customDeltaValue = null;
    this.customExactScore = null;
    this.gameplay.openAdjustPointsModal(teamId);
  }

  closeAdjustScoreModal(): void {
    this.gameplay.closeAdjustPointsModal();
  }

  selectAdjustingTeam(teamId: string): void {
    this.gameplay.openAdjustPointsModal(teamId);
  }

  applyDelta(teamId: string, delta: number): void {
    this.gameplay.adjustTeamScore(teamId, delta);
    Swal.fire({
      icon: 'success',
      title: (delta > 0 ? `+${delta}` : `${delta}`) + ` ${this.i18n.t('questions.points')}`,
      text: this.i18n.t('gameplay.pointsAdjusted'),
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top',
    });
  }

  applyCustomDelta(teamId: string): void {
    if (this.customDeltaValue === null || isNaN(this.customDeltaValue) || this.customDeltaValue === 0) return;
    const delta = Number(this.customDeltaValue);
    this.applyDelta(teamId, delta);
    this.customDeltaValue = null;
  }

  applyExactScore(teamId: string): void {
    if (this.customExactScore === null || isNaN(this.customExactScore)) return;
    const score = Number(this.customExactScore);
    this.gameplay.setTeamScore(teamId, score);
    this.customExactScore = null;
    Swal.fire({
      icon: 'success',
      title: `${score} ${this.i18n.t('questions.points')}`,
      text: this.i18n.t('gameplay.pointsAdjusted'),
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top',
    });
  }

  selectTeam(teamId: string): void {
    this.gameplay.selectTeam(teamId);
  }

  getTeamActiveCard(teamId: string): PowerCard | null {
    return this.gameplay.getTeamActiveCard(teamId);
  }

  getCardLabel(cardType: PowerCardType): string {
    switch (cardType) {
      case 'double_points': return this.i18n.t('gameplay.cardDouble');
      case 'steal_points': return this.i18n.t('gameplay.cardSteal');
      case 'extra_time': return this.i18n.t('gameplay.cardExtraTime');
    }
  }

  toggleDoublePointsCard(teamId: string, cardId: string): void {
    if (this.activeCard()?.cardId === cardId) {
      this.gameplay.cancelPowerCard();
    } else {
      this.gameplay.playPowerCard(teamId, cardId, 'double_points');
    }
  }

  async useStealPointsCard(teamId: string, card: PowerCard): Promise<void> {
    const session = this.session();
    if (!session) return;

    const otherTeams = this.teams().filter(t => t.id !== teamId);
    if (otherTeams.length === 0) {
      await Swal.fire({
        icon: 'warning',
        text: this.i18n.t('greenCard.stealNoTarget'),
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    const inputOptions: Record<string, string> = {};
    for (const t of otherTeams) {
      inputOptions[t.id] = `${t.name} (${t.totalScore} ${this.i18n.t('questions.points')})`;
    }

    const result = await Swal.fire({
      title: this.i18n.t('greenCard.selectTargetTeam'),
      input: 'radio',
      inputOptions,
      showCancelButton: true,
      confirmButtonText: this.i18n.t('greenCard.useCard'),
      cancelButtonText: this.i18n.t('common.cancel'),
      confirmButtonColor: '#10b981',
      inputValidator: (value) => {
        if (!value) return this.i18n.t('greenCard.selectTargetTeam');
        return null;
      },
    });

    if (result.isConfirmed && result.value) {
      const targetTeamId = result.value;
      const targetTeam = this.teams().find(t => t.id === targetTeamId);
      const usingTeam = this.teams().find(t => t.id === teamId);
      if (!targetTeam || !usingTeam) return;

      this.greenCardService.executeStealPoints(session.id, card, usingTeam, targetTeam);
      this.gameplay.refreshTeams();
      this.gameplay.refreshSessionCards();

      await Swal.fire({
        icon: 'success',
        title: this.i18n.t('greenCard.cardUsedTitle'),
        text: this.i18n.t('greenCard.stealSuccess', { using: usingTeam.name, target: targetTeam.name }),
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top'
      });
    }
  }

  async useExtraTimeCard(teamId: string, card: PowerCard): Promise<void> {
    const session = this.session();
    if (!session) return;

    if (this.isAnswerSubmitted()) {
      await Swal.fire({
        icon: 'warning',
        text: this.i18n.t('greenCard.extraTimeFinalized'),
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    const result = await Swal.fire({
      title: this.i18n.t('greenCard.extraTimeTitle'),
      input: 'range',
      inputAttributes: {
        min: '10',
        max: '60',
        step: '5',
      },
      inputValue: '30',
      showCancelButton: true,
      confirmButtonText: this.i18n.t('greenCard.useCard'),
      cancelButtonText: this.i18n.t('common.cancel'),
      confirmButtonColor: '#10b981',
      inputLabel: this.i18n.t('greenCard.extraTimeSeconds'),
    });

    if (result.isConfirmed) {
      const extraSeconds = Number(result.value) || 30;

      // Add time to the timer
      this.gameplay.timerService.addSeconds(extraSeconds);

      // Consume the card
      this.greenCardService.executeExtraTime(
        session.id, card, teamId, extraSeconds, this.gameplay.currentIndex()
      );

      // Refresh cards signal
      this.gameplay.refreshSessionCards();

      await Swal.fire({
        icon: 'success',
        title: this.i18n.t('greenCard.extraTimeSuccess', { seconds: extraSeconds }),
        confirmButtonColor: '#10b981',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top',
      });
    }
  }

  async openGrantCardDialog(teamId: string): Promise<void> {
    const session = this.session();
    if (!session) return;

    const team = this.teams().find(t => t.id === teamId);
    if (!team) return;

    const result = await Swal.fire({
      title: this.i18n.t('greenCard.grantToTeam', { team: team.name }),
      input: 'radio',
      inputOptions: {
        'double_points': `⚡ ${this.i18n.t('greenCard.doublePoints')}`,
        'steal_points': `🔄 ${this.i18n.t('greenCard.stealPoints')}`,
        'extra_time': `⏱ ${this.i18n.t('greenCard.extraTime')}`,
      },
      showCancelButton: true,
      confirmButtonText: this.i18n.t('greenCard.grantCard'),
      cancelButtonText: this.i18n.t('common.cancel'),
      confirmButtonColor: '#10b981',
      inputValidator: (value) => {
        if (!value) return this.i18n.t('greenCard.selectCardType');
        return null;
      },
    });

    if (result.isConfirmed && result.value) {
      const cardType = result.value as PowerCardType;
      const grantResult = this.greenCardService.grantCard(session.id, teamId, cardType);

      if (grantResult.success) {
        this.gameplay.refreshSessionCards();

        await Swal.fire({
          icon: 'success',
          title: this.i18n.t('greenCard.grantSuccess', { team: team.name }),
          confirmButtonColor: '#10b981',
          timer: 2500,
          showConfirmButton: false,
          toast: true,
          position: 'top',
        });
      } else if (grantResult.existingCard) {
        // Team already has a card — ask to replace
        const existingLabel = this.getCardLabel(grantResult.existingCard.cardType);
        const replaceResult = await Swal.fire({
          icon: 'question',
          title: this.i18n.t('greenCard.teamHasCard', { team: team.name, card: existingLabel }),
          showCancelButton: true,
          confirmButtonText: this.i18n.t('greenCard.replaceCard'),
          cancelButtonText: this.i18n.t('greenCard.keepExisting'),
          confirmButtonColor: '#f59e0b',
        });

        if (replaceResult.isConfirmed) {
          this.greenCardService.replaceCard(session.id, teamId, cardType);
          this.gameplay.refreshSessionCards();

          await Swal.fire({
            icon: 'success',
            title: this.i18n.t('greenCard.replaced'),
            confirmButtonColor: '#10b981',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top',
          });
        }
      }
    }
  }

  confirmSkipQuestion(): void {
    this.onSkipQuestion.emit();
  }
}
