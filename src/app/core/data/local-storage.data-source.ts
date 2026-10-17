import { Injectable } from '@angular/core';
import { DataSource } from './data-source';
import { GameClass } from '../models/game-class.model';
import { Team, TeamMember } from '../models/team.model';
import { Question } from '../models/question.model';
import { QuestionGroup, BankQuestion } from '../models/question-bank.model';
import { Session, SessionQuestionState, QuestionResult } from '../models/session.model';
import { PowerCard, CardEvent } from '../models/power-card.model';

/**
 * Storage key prefix to namespace all Quiziyyy data in LocalStorage.
 */
const PREFIX = 'quiziyyy';

/**
 * Storage keys for each entity collection.
 */
const KEYS = {
  classes: `${PREFIX}_classes`,
  teams: `${PREFIX}_teams`,
  members: `${PREFIX}_members`,
  questions: `${PREFIX}_questions`,
  sessions: `${PREFIX}_sessions`,
  sessionQuestionStates: `${PREFIX}_sq_states`,
  results: `${PREFIX}_results`,
  powerCards: `${PREFIX}_power_cards`,
  cardEvents: `${PREFIX}_card_events`,
  groups: `${PREFIX}_groups`,
  bankQuestions: `${PREFIX}_bank_questions`,
} as const;

// ── Generic helpers ─────────────────────────────────────────

function loadAll<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function saveAll<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function upsert<T extends { id: string }>(key: string, item: T): void {
  const items = loadAll<T>(key);
  const index = items.findIndex(i => i.id === item.id);
  if (index >= 0) {
    items[index] = item;
  } else {
    items.push(item);
  }
  saveAll(key, items);
}

function remove<T extends { id: string }>(key: string, id: string): void {
  const items = loadAll<T>(key);
  saveAll(key, items.filter(i => i.id !== id));
}

function filterBy<T>(key: string, field: keyof T, value: unknown): T[] {
  return loadAll<T>(key).filter(item => item[field] === value);
}

// ── Implementation ──────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LocalStorageDataSource extends DataSource {

  // ── Classes ──────────────────────────────────────────────

  getClasses(): GameClass[] {
    return loadAll<GameClass>(KEYS.classes);
  }

  saveClass(gameClass: GameClass): void {
    upsert(KEYS.classes, gameClass);
  }

  deleteClass(id: string): void {
    // Cascade: delete related teams, members, questions, sessions, etc.
    const teams = this.getTeamsByClass(id);
    for (const team of teams) {
      this.deleteTeam(team.id);
    }
    const questions = this.getQuestionsByClass(id);
    for (const question of questions) {
      this.deleteQuestion(question.id);
    }
    const sessions = this.getSessionsByClass(id);
    for (const session of sessions) {
      this.deleteSession(session.id);
    }
    remove<GameClass>(KEYS.classes, id);
  }

  // ── Teams ────────────────────────────────────────────────

  getTeamsByClass(classId: string): Team[] {
    return filterBy<Team>(KEYS.teams, 'classId', classId);
  }

  saveTeam(team: Team): void {
    upsert(KEYS.teams, team);
  }

  deleteTeam(id: string): void {
    // Also delete members for this team
    const allMembers = loadAll<TeamMember>(KEYS.members);
    saveAll(KEYS.members, allMembers.filter(m => m.teamId !== id));
    // Also delete power cards for this team
    const allCards = loadAll<PowerCard>(KEYS.powerCards);
    saveAll(KEYS.powerCards, allCards.filter(c => c.teamId !== id));
    remove<Team>(KEYS.teams, id);
  }

  // ── Team Members ─────────────────────────────────────────

  getMembersByTeam(teamId: string): TeamMember[] {
    return filterBy<TeamMember>(KEYS.members, 'teamId', teamId);
  }

  saveMembers(teamId: string, members: TeamMember[]): void {
    const all = loadAll<TeamMember>(KEYS.members);
    const others = all.filter(m => m.teamId !== teamId);
    saveAll(KEYS.members, [...others, ...members]);
  }

  // ── Questions ────────────────────────────────────────────

  getQuestionsByClass(classId: string): Question[] {
    // Migration: ensure isGreenCardReward defaults to false for old questions
    return filterBy<Question>(KEYS.questions, 'classId', classId).map(q => ({
      ...q,
      isGreenCardReward: q.isGreenCardReward ?? false,
    }));
  }

  saveQuestion(question: Question): void {
    upsert(KEYS.questions, question);
  }

  deleteQuestion(id: string): void {
    remove<Question>(KEYS.questions, id);
  }

  // ── Sessions ─────────────────────────────────────────────

  getSessionsByClass(classId: string): Session[] {
    return filterBy<Session>(KEYS.sessions, 'classId', classId);
  }

  saveSession(session: Session): void {
    upsert(KEYS.sessions, session);
  }

  deleteSession(id: string): void {
    // Cascade: delete session question states, results, card events, cards
    const allStates = loadAll<SessionQuestionState>(KEYS.sessionQuestionStates);
    saveAll(KEYS.sessionQuestionStates, allStates.filter(s => s.sessionId !== id));

    const allResults = loadAll<QuestionResult>(KEYS.results);
    saveAll(KEYS.results, allResults.filter(r => r.sessionId !== id));

    const allEvents = loadAll<CardEvent>(KEYS.cardEvents);
    saveAll(KEYS.cardEvents, allEvents.filter(e => e.sessionId !== id));

    const allCards = loadAll<PowerCard>(KEYS.powerCards);
    saveAll(KEYS.powerCards, allCards.filter(c => c.sessionId !== id));

    remove<Session>(KEYS.sessions, id);
  }

  // ── Session Question States ──────────────────────────────

  getSessionQuestionStates(sessionId: string): SessionQuestionState[] {
    return filterBy<SessionQuestionState>(KEYS.sessionQuestionStates, 'sessionId', sessionId);
  }

  saveSessionQuestionStates(sessionId: string, states: SessionQuestionState[]): void {
    const all = loadAll<SessionQuestionState>(KEYS.sessionQuestionStates);
    const others = all.filter(s => s.sessionId !== sessionId);
    saveAll(KEYS.sessionQuestionStates, [...others, ...states]);
  }

  // ── Question Results ─────────────────────────────────────

  getResultsBySession(sessionId: string): QuestionResult[] {
    return filterBy<QuestionResult>(KEYS.results, 'sessionId', sessionId);
  }

  saveResult(result: QuestionResult): void {
    upsert(KEYS.results, result);
  }

  // ── Power Cards (Green Cards) ────────────────────────────

  getCardsBySession(sessionId: string): PowerCard[] {
    return filterBy<PowerCard>(KEYS.powerCards, 'sessionId', sessionId);
  }

  getActiveCardForTeamInSession(teamId: string, sessionId: string): PowerCard | null {
    const cards = this.getCardsBySession(sessionId);
    return cards.find(c => c.teamId === teamId && !c.isUsed) ?? null;
  }

  saveCard(card: PowerCard): void {
    upsert(KEYS.powerCards, card);
  }

  deleteCard(cardId: string): void {
    remove<PowerCard>(KEYS.powerCards, cardId);
  }

  // ── Card Events ──────────────────────────────────────────

  getCardEventsBySession(sessionId: string): CardEvent[] {
    return filterBy<CardEvent>(KEYS.cardEvents, 'sessionId', sessionId);
  }

  saveCardEvent(event: CardEvent): void {
    upsert(KEYS.cardEvents, event);
  }

  // ── Groups (Central Question Bank) ───────────────────────

  getGroups(): QuestionGroup[] {
    return loadAll<QuestionGroup>(KEYS.groups);
  }

  saveGroup(group: QuestionGroup): void {
    upsert(KEYS.groups, group);
  }

  deleteGroup(id: string): void {
    // Delete bank questions belonging to this group
    const allBankQ = loadAll<BankQuestion>(KEYS.bankQuestions);
    saveAll(KEYS.bankQuestions, allBankQ.filter(q => q.groupId !== id));
    remove<QuestionGroup>(KEYS.groups, id);
  }

  // ── Bank Questions (Central Question Bank) ───────────────

  getBankQuestions(groupId?: string): BankQuestion[] {
    const list = loadAll<BankQuestion>(KEYS.bankQuestions);
    const filtered = groupId ? list.filter(q => q.groupId === groupId) : list;
    return filtered.map(q => ({
      ...q,
      category: q.category || 'General',
      questionType: q.questionType || 'mcq',
      isGreenCardReward: q.isGreenCardReward ?? false,
    }));
  }

  saveBankQuestion(question: BankQuestion): void {
    upsert(KEYS.bankQuestions, question);
  }

  saveBankQuestionsBatch(questions: BankQuestion[]): void {
    const existing = loadAll<BankQuestion>(KEYS.bankQuestions);
    const map = new Map<string, BankQuestion>(existing.map(q => [q.id, q]));
    for (const q of questions) {
      map.set(q.id, q);
    }
    saveAll(KEYS.bankQuestions, Array.from(map.values()));
  }

  deleteBankQuestion(id: string): void {
    remove<BankQuestion>(KEYS.bankQuestions, id);
  }
}
