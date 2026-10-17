import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ClassService } from '../../core/services/class.service';
import { QuestionService } from '../../core/services/question.service';
import { TeamService } from '../../core/services/team.service';
import { I18nService } from '../../core/services/i18n.service';
import { NavbarComponent, NavAction } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-session-results',
  imports: [NavbarComponent],
  templateUrl: './session-results.component.html',
})
export class SessionResultsComponent implements OnInit {
  classId = input.required<string>();
  sessionId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private classService = inject(ClassService);
  private teamService = inject(TeamService);
  private questionService = inject(QuestionService);

  readonly navActions = computed<NavAction[]>(() => [
    {
      label: this.i18n.t('results.returnToDashboard'),
      icon: 'pi pi-arrow-left',
      callback: () => this.goToDashboard(),
      style: 'secondary',
    },
    {
      label: this.i18n.t('dashboard.newSession'),
      icon: 'pi pi-plus',
      callback: () => this.goToNewSession(),
      style: 'primary',
      hideOnMobile: false,
    },
  ]);

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  readonly session = computed(() => {
    return this.sessionService.sessions().find(s => s.id === this.sessionId()) ?? null;
  });

  readonly results = computed(() => {
    const details = this.sessionService.getSessionDetails(this.sessionId());
    return details ? details.results : [];
  });

  readonly teams = this.teamService.teams;

  readonly rankedTeams = computed(() => {
    return [...this.teams()].sort((a, b) => b.totalScore - a.totalScore);
  });

  ngOnInit(): void {
    const cid = this.classId();
    this.classService.selectClass(cid);
    this.sessionService.loadSessions(cid);
    this.teamService.loadTeams(cid);
    this.questionService.loadQuestions(cid);
  }

  goToDashboard(): void {
    this.router.navigate(['/classes', this.classId()]);
  }

  goToNewSession(): void {
    this.router.navigate(['/classes', this.classId(), 'sessions', 'new']);
  }

  getTeamName(teamId: string): string {
    const t = this.teams().find(team => team.id === teamId);
    return t ? t.name : 'Unknown Team';
  }

  getQuestionText(questionId: string): string {
    const q = this.questionService.getQuestionById(questionId, this.classId());
    return q ? q.text : 'Question';
  }
}
