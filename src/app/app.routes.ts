import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/welcome/welcome.component').then(m => m.WelcomeComponent),
  },
  {
    path: 'instructions',
    loadComponent: () => import('./features/instructions/instructions.component').then(m => m.InstructionsComponent),
  },
  {
    path: 'rules',
    loadComponent: () => import('./features/rules/rules.component').then(m => m.RulesComponent),
  },
  {
    path: 'classes',
    loadComponent: () => import('./features/classes/class-list.component').then(m => m.ClassListComponent),
  },
  {
    path: 'classes/:classId',
    loadComponent: () => import('./features/classes/class-dashboard.component').then(m => m.ClassDashboardComponent),
  },
  {
    path: 'classes/:classId/teams',
    loadComponent: () => import('./features/teams/team-management.component').then(m => m.TeamManagementComponent),
  },
  {
    path: 'classes/:classId/questions',
    loadComponent: () => import('./features/questions/question-bank.component').then(m => m.QuestionBankComponent),
  },
  {
    path: 'classes/:classId/sessions/new',
    loadComponent: () => import('./features/sessions/session-setup.component').then(m => m.SessionSetupComponent),
  },
  {
    path: 'classes/:classId/sessions/:sessionId/play',
    loadComponent: () => import('./features/gameplay/gameplay.component').then(m => m.GameplayComponent),
  },
  {
    path: 'classes/:classId/sessions/:sessionId/results',
    loadComponent: () => import('./features/results/session-results.component').then(m => m.SessionResultsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
