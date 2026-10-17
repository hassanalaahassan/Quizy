import { Injectable, computed, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { GameClass } from '../models/game-class.model';
import { generateId, now } from '../utils';

export interface ClassStats {
  teamCount: number;
  questionCount: number;
  sessionCount: number;
  completedSessionCount: number;
  activeSessionId: string | null;
  activeSessionName: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClassService {
  private dataSource = inject(DataSource);

  // State
  private readonly _classes = signal<GameClass[]>([]);
  private readonly _selectedClassId = signal<string | null>(null);

  // Readonly signals
  readonly classes = this._classes.asReadonly();
  readonly selectedClassId = this._selectedClassId.asReadonly();

  readonly selectedClass = computed(() => {
    const id = this._selectedClassId();
    if (!id) return null;
    return this._classes().find(c => c.id === id) ?? null;
  });

  constructor() {
    this.refreshClasses();
  }

  refreshClasses(): void {
    const data = this.dataSource.getClasses();
    this._classes.set(data);
  }

  selectClass(id: string | null): void {
    this._selectedClassId.set(id);
  }

  createClass(name: string, groupId?: string): GameClass {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Class name is required');
    }

    const timestamp = now();
    const newClass: GameClass = {
      id: generateId(),
      name: trimmed,
      groupId: groupId || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.dataSource.saveClass(newClass);
    this.refreshClasses();
    return newClass;
  }

  updateClass(id: string, name: string, groupId?: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = this._classes().find(c => c.id === id);
    if (!existing) return;

    const updated: GameClass = {
      ...existing,
      name: trimmed,
      groupId: groupId !== undefined ? groupId : existing.groupId,
      updatedAt: now(),
    };

    this.dataSource.saveClass(updated);
    this.refreshClasses();
  }

  deleteClass(id: string): void {
    this.dataSource.deleteClass(id);
    if (this._selectedClassId() === id) {
      this._selectedClassId.set(null);
    }
    this.refreshClasses();
  }

  getClassStats(classId: string): ClassStats {
    const teams = this.dataSource.getTeamsByClass(classId);
    const questions = this.dataSource.getQuestionsByClass(classId);
    const sessions = this.dataSource.getSessionsByClass(classId);

    const activeSession = sessions.find(
      s => s.status === 'in_progress' || s.status === 'paused'
    );
    const completedSessions = sessions.filter(s => s.status === 'completed');

    return {
      teamCount: teams.length,
      questionCount: questions.length,
      sessionCount: sessions.length,
      completedSessionCount: completedSessions.length,
      activeSessionId: activeSession ? activeSession.id : null,
      activeSessionName: activeSession ? activeSession.name : null,
    };
  }
}
