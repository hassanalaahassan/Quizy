/**
 * Session lifecycle states.
 */
export type SessionStatus = 'not_started' | 'in_progress' | 'paused' | 'completed';

/**
 * A Session represents one gameplay session within a class.
 * It contains an ordered list of question IDs and tracks progress.
 */
export interface Session {
  id: string;
  classId: string;
  name: string;
  status: SessionStatus;
  questionIds: string[];
  currentQuestionIndex: number;
  startedAt: number | null;
  pausedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

/**
 * Per-question state within a session.
 */
export type SessionQuestionStatus = 'pending' | 'active' | 'answered' | 'skipped';

export interface SessionQuestionState {
  id: string;
  sessionId: string;
  questionId: string;
  orderIndex: number;
  status: SessionQuestionStatus;
  timerRemainingSeconds: number | null;
}

/**
 * The result of a team answering a question during a session.
 */
export interface QuestionResult {
  id: string;
  sessionId: string;
  sessionQuestionId: string;
  questionId: string;
  teamId: string;
  selectedOptionIndex: number;
  /** For text-based question types (short_answer / complete). */
  textAnswer?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  timestamp: number;
}
