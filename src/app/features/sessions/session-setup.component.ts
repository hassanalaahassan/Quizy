import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClassService } from '../../core/services/class.service';
import { QuestionService } from '../../core/services/question.service';
import { SessionService } from '../../core/services/session.service';
import { TeamService } from '../../core/services/team.service';
import { I18nService } from '../../core/services/i18n.service';
import { formatTimer } from '../../core/utils';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';

@Component({
  selector: 'app-session-setup',
  imports: [FormsModule, LanguageSwitcherComponent],
  templateUrl: './session-setup.component.html',
})
export class SessionSetupComponent implements OnInit {
  classId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private questionService = inject(QuestionService);
  private sessionService = inject(SessionService);
  private teamService = inject(TeamService);

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  readonly availableQuestions = this.questionService.questions;
  readonly teams = this.teamService.teams;

  sessionName = '';
  readonly selectedQuestionIds = signal<string[]>([]);

  readonly selectedQuestions = computed(() => {
    const selectedIds = new Set(this.selectedQuestionIds());
    return this.availableQuestions().filter(q => selectedIds.has(q.id));
  });

  readonly totalPoints = computed(() => {
    return this.selectedQuestions().reduce((sum, q) => sum + q.points, 0);
  });

  readonly totalTimerSeconds = computed(() => {
    return this.selectedQuestions().reduce((sum, q) => sum + q.timerSeconds, 0);
  });

  ngOnInit(): void {
    const cid = this.classId();
    this.questionService.loadQuestions(cid);
    this.teamService.loadTeams(cid);
    this.sessionService.loadSessions(cid);

    const existingCount = this.sessionService.sessions().length;
    const isAr = this.i18n.lang() === 'ar';
    this.sessionName = isAr
      ? `الجلسة ${existingCount + 1}: ساحة التحدي الصفية`
      : `Session ${existingCount + 1}: Classroom Arena`;

    const allIds = this.questionService.questions().map(q => q.id);
    this.selectedQuestionIds.set(allIds);
  }

  goBack(): void {
    this.router.navigate(['/classes', this.classId()]);
  }

  goToQuestions(): void {
    this.router.navigate(['/classes', this.classId(), 'questions']);
  }

  formatTimer(seconds: number): string {
    return formatTimer(seconds);
  }

  isQuestionSelected(id: string): boolean {
    return this.selectedQuestionIds().includes(id);
  }

  toggleQuestion(id: string): void {
    const current = [...this.selectedQuestionIds()];
    const index = current.indexOf(id);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(id);
    }
    this.selectedQuestionIds.set(current);
  }

  selectAllQuestions(): void {
    this.selectedQuestionIds.set(this.availableQuestions().map(q => q.id));
  }

  clearSelectedQuestions(): void {
    this.selectedQuestionIds.set([]);
  }

  saveSessionInternal(): string {
    const created = this.sessionService.createSession(
      this.classId(),
      this.sessionName.trim(),
      this.selectedQuestionIds()
    );
    return created.id;
  }

  saveForLater(): void {
    this.saveSessionInternal();
    this.goBack();
  }

  saveAndPlay(): void {
    const sessionId = this.saveSessionInternal();
    this.router.navigate(['/classes', this.classId(), 'sessions', sessionId, 'play']);
  }
}
