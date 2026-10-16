import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { GameplayService } from '../../../core/services/gameplay.service';
import { ClassService } from '../../../core/services/class.service';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher.component';
import { formatTimer } from '../../../core/utils';

@Component({
  selector: 'app-gameplay-header',
  imports: [LanguageSwitcherComponent],
  templateUrl: './gameplay-header.component.html',
  styleUrl: './gameplay-header.component.css',
})
export class GameplayHeaderComponent {
  classId = input.required<string>();
  
  readonly i18n = inject(I18nService);
  private gameplay = inject(GameplayService);
  private classService = inject(ClassService);

  readonly session = this.gameplay.session;
  readonly currentIndex = this.gameplay.currentIndex;
  readonly totalQuestionsCount = this.gameplay.totalQuestionsCount;
  readonly timerRunning = this.gameplay.timerService.isRunning;

  onPauseAndExit = output<void>();

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  toggleTimer(): void {
    if (this.timerRunning()) {
      this.gameplay.timerService.pause();
    } else {
      this.gameplay.timerService.resume();
    }
  }

  addTime(seconds: number): void {
    this.gameplay.timerService.addSeconds(seconds);
  }

  openAdjustPoints(): void {
    this.gameplay.openAdjustPointsModal();
  }
}
