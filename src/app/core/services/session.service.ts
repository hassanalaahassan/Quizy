import { Injectable, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { Session, SessionQuestionState, SessionStatus, QuestionResult } from '../models/session.model';
import { generateId, now } from '../utils';

export interface SessionWithDetails {
  session: Session;
  states: SessionQuestionState[];
  results: QuestionResult[];
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private dataSource = inject(DataSource);

  private readonly _sessions = signal<Session[]>([]);
  readonly sessions = this._sessions.asReadonly();

  loadSessions(classId: string): void {
    const list = this.dataSource.getSessionsByClass(classId);
    // Sort by createdAt descending
    this._sessions.set([...list].sort((a, b) => b.createdAt - a.createdAt));
  }

  getSessionById(sessionId: string, classId?: string): Session | null {
    if (classId) {
      const list = this.dataSource.getSessionsByClass(classId);
      return list.find(s => s.id === sessionId) ?? null;
    }
    // Search within current loaded
    return this._sessions().find(s => s.id === sessionId) ?? null;
  }

  getSessionDetails(sessionId: string): SessionWithDetails | null {
    const all = this._sessions();
    const session = all.find(s => s.id === sessionId);
    if (!session) return null;

    return {
      session,
      states: this.dataSource.getSessionQuestionStates(sessionId),
      results: this.dataSource.getResultsBySession(sessionId),
    };
  }

  createSession(classId: string, name: string, questionIds: string[]): Session {
    if (!name.trim()) throw new Error('Session name is required');
    if (questionIds.length === 0) throw new Error('Select at least one question for the session');

    const sessionId = generateId();
    const timestamp = now();

    const session: Session = {
      id: sessionId,
      classId,
      name: name.trim(),
      status: 'not_started',
      questionIds,
      currentQuestionIndex: 0,
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      createdAt: timestamp,
    };

    this.dataSource.saveSession(session);

    // Initial question states
    const states: SessionQuestionState[] = questionIds.map((qId, idx) => ({
      id: generateId(),
      sessionId,
      questionId: qId,
      orderIndex: idx,
      status: 'pending',
      timerRemainingSeconds: null,
    }));
    this.dataSource.saveSessionQuestionStates(sessionId, states);

    this.loadSessions(classId);
    return session;
  }

  updateSessionStatus(session: Session, status: SessionStatus): void {
    const updated: Session = {
      ...session,
      status,
      startedAt: status === 'in_progress' && !session.startedAt ? now() : session.startedAt,
      pausedAt: status === 'paused' ? now() : session.pausedAt,
      completedAt: status === 'completed' ? now() : session.completedAt,
    };
    this.dataSource.saveSession(updated);
    this.loadSessions(session.classId);
  }

  deleteSession(sessionId: string, classId: string): void {
    this.dataSource.deleteSession(sessionId);
    this.loadSessions(classId);
  }
}
