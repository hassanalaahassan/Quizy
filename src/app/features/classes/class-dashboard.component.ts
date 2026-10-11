import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ClassService } from '../../core/services/class.service';
import { TeamService, TeamWithDetails } from '../../core/services/team.service';
import { SessionService } from '../../core/services/session.service';
import { QuestionService } from '../../core/services/question.service';
import { I18nService } from '../../core/services/i18n.service';
import { SessionStatus } from '../../core/models/session.model';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';

@Component({
  selector: 'app-class-dashboard',
  imports: [LanguageSwitcherComponent],
  templateUrl: './class-dashboard.component.html',
})
export class ClassDashboardComponent implements OnInit {
  classId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private teamService = inject(TeamService);
  private sessionService = inject(SessionService);
  private questionService = inject(QuestionService);
  private confirmationService = inject(ConfirmationService);

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  readonly teams = this.teamService.teams;
  readonly sessions = this.sessionService.sessions;
  readonly questions = this.questionService.questions;

  readonly teamsDetails = computed(() => {
    this.teams(); // dependency trigger
    return this.teamService.getTeamsWithDetails(this.classId());
  });

  readonly sortedTeams = computed(() => {
    return [...this.teamsDetails()].sort((a, b) => b.team.totalScore - a.team.totalScore);
  });

  readonly combinedScore = computed(() => {
    return this.teams().reduce((sum, t) => sum + t.totalScore, 0);
  });

  readonly completedSessionsCount = computed(() => {
    return this.sessions().filter(s => s.status === 'completed').length;
  });

  readonly activeOrPausedSession = computed(() => {
    return this.sessions().find(s => s.status === 'in_progress' || s.status === 'paused') ?? null;
  });

  ngOnInit(): void {
    const id = this.classId();
    this.classService.selectClass(id);
    this.teamService.loadTeams(id);
    this.sessionService.loadSessions(id);
    this.questionService.loadQuestions(id);
  }

  goBack(): void {
    this.router.navigate(['/classes']);
  }

  goToTeams(): void {
    this.router.navigate(['/classes', this.classId(), 'teams']);
  }

  goToQuestions(): void {
    this.router.navigate(['/classes', this.classId(), 'questions']);
  }

  goToNewSession(): void {
    this.router.navigate(['/classes', this.classId(), 'sessions', 'new']);
  }

  continueSession(sessionId: string): void {
    this.router.navigate(['/classes', this.classId(), 'sessions', sessionId, 'play']);
  }

  viewResults(sessionId: string): void {
    this.router.navigate(['/classes', this.classId(), 'sessions', sessionId, 'results']);
  }

  confirmDeleteSession(s: { id: string; name: string }): void {
    this.confirmationService.confirm({
      header: this.i18n.t('dashboard.deleteSessionTitle'),
      message: this.i18n.t('dashboard.deleteSessionMessage', { name: s.name }),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.sessionService.deleteSession(s.id, this.classId());
      },
    });
  }

  getLeaderName(teamDetail: TeamWithDetails): string {
    const leader = teamDetail.members.find(m => m.isLeader);
    return leader ? leader.name : teamDetail.members[0]?.name || '—';
  }

  statusBadgeClass(status: SessionStatus): string {
    switch (status) {
      case 'in_progress':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'paused':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  statusBadgeText(status: SessionStatus): string {
    switch (status) {
      case 'in_progress': return this.i18n.t('dashboard.statusInProgress');
      case 'paused': return this.i18n.t('dashboard.statusPaused');
      case 'completed': return this.i18n.t('dashboard.statusCompleted');
      default: return this.i18n.t('dashboard.statusNotStarted');
    }
  }

  formatDate(epochMs: number): string {
    const d = new Date(epochMs);
    return d.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
