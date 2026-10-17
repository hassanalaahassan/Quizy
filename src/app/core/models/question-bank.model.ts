import { PenaltyMode, QuestionOption, QuestionType } from './question.model';

/**
 * A Question Group (e.g. "Group 1 / Grade 1", "Group 2 / Grade 2").
 * Groups contain independent central question banks that classrooms can import from.
 */
export interface QuestionGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
}

/**
 * A Question residing in the Central Question Bank under a specific group.
 * Independent of individual classroom instances.
 */
export interface BankQuestion {
  id: string;
  groupId: string;
  category: string;
  questionType: QuestionType;
  text: string;
  options: QuestionOption[];
  correctOptionIndex: number;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  points: number;
  timerSeconds: number;
  penaltyMode: PenaltyMode;
  isGreenCardReward: boolean;
  createdAt: number;
  updatedAt?: number;
}

/**
 * Excel parsed row structure for importing questions.
 */
export interface ExcelQuestionRow {
  question: string;
  answer: string;
  category?: string;
  type?: string;
  points?: number;
  timerSeconds?: number;
  penaltyMode?: PenaltyMode;
  options?: string[];
}

/**
 * Summary result after performing an Excel import.
 */
export interface ExcelImportSummary {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  errors: string[];
}
