import { GameClass } from '../models/game-class.model';
import { Team, TeamMember } from '../models/team.model';
import { Question } from '../models/question.model';
import { QuestionGroup, BankQuestion } from '../models/question-bank.model';
import { Session, SessionQuestionState, QuestionResult } from '../models/session.model';
import { PowerCard, CardEvent } from '../models/power-card.model';

/**
 * Abstract data access layer.
 *
 * The application interacts with data exclusively through this class.
 * Currently implemented by LocalStorageDataSource.
 * Can be swapped for ApiDataSource later without touching services or UI.
 */
export abstract class DataSource {
  // ── Classes ──────────────────────────────────────────────
  abstract getClasses(): GameClass[];
  abstract saveClass(gameClass: GameClass): void;
  abstract deleteClass(id: string): void;

  // ── Teams ────────────────────────────────────────────────
  abstract getTeamsByClass(classId: string): Team[];
  abstract saveTeam(team: Team): void;
  abstract deleteTeam(id: string): void;

  // ── Team Members ─────────────────────────────────────────
  abstract getMembersByTeam(teamId: string): TeamMember[];
  abstract saveMembers(teamId: string, members: TeamMember[]): void;

  // ── Questions ────────────────────────────────────────────
  abstract getQuestionsByClass(classId: string): Question[];
  abstract saveQuestion(question: Question): void;
  abstract deleteQuestion(id: string): void;

  // ── Sessions ─────────────────────────────────────────────
  abstract getSessionsByClass(classId: string): Session[];
  abstract saveSession(session: Session): void;
  abstract deleteSession(id: string): void;

  // ── Session Question States ──────────────────────────────
  abstract getSessionQuestionStates(sessionId: string): SessionQuestionState[];
  abstract saveSessionQuestionStates(sessionId: string, states: SessionQuestionState[]): void;

  // ── Question Results ─────────────────────────────────────
  abstract getResultsBySession(sessionId: string): QuestionResult[];
  abstract saveResult(result: QuestionResult): void;

  // ── Power Cards (Green Cards) ────────────────────────────
  abstract getCardsBySession(sessionId: string): PowerCard[];
  abstract getActiveCardForTeamInSession(teamId: string, sessionId: string): PowerCard | null;
  abstract saveCard(card: PowerCard): void;
  abstract deleteCard(cardId: string): void;

  // ── Card Events ──────────────────────────────────────────
  abstract getCardEventsBySession(sessionId: string): CardEvent[];
  abstract saveCardEvent(event: CardEvent): void;

  // ── Groups (Central Question Bank) ───────────────────────
  abstract getGroups(): QuestionGroup[];
  abstract saveGroup(group: QuestionGroup): void;
  abstract deleteGroup(id: string): void;

  // ── Bank Questions (Central Question Bank) ───────────────
  abstract getBankQuestions(groupId?: string): BankQuestion[];
  abstract saveBankQuestion(question: BankQuestion): void;
  abstract saveBankQuestionsBatch(questions: BankQuestion[]): void;
  abstract deleteBankQuestion(id: string): void;
}
