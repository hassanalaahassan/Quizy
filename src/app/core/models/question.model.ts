/**
 * Penalty behavior when a team answers incorrectly.
 * - 'none': no score change
 * - 'deduct': subtract the question's points from the team's score
 */
export type PenaltyMode = 'none' | 'deduct';

/**
 * Supported question types.
 * - 'mcq': Multiple choice (2-6 options, one correct)
 * - 'true_false': True or False (two fixed options)
 * - 'short_answer': Free text answer typed by student
 * - 'complete': Fill-in-the-blank sentence completion
 */
export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'complete';

export interface QuestionOption {
  text: string;
}

/**
 * A question belongs to a class's question bank.
 * The same question can be reused across multiple sessions.
 */
export interface Question {
  id: string;
  classId: string;

  /** Question type — defaults to 'mcq' for backward compatibility. */
  questionType?: QuestionType;

  text: string;

  /** Options for MCQ and True/False types. Empty array for short_answer and complete. */
  options: QuestionOption[];

  /** Index of the correct option (MCQ / True/False). -1 for text-based types. */
  correctOptionIndex: number;

  /** The correct text answer for short_answer and complete types. */
  correctAnswer?: string;

  /** Accepted alternative answers (case-insensitive match). */
  acceptedAnswers?: string[];

  points: number;
  timerSeconds: number;
  penaltyMode: PenaltyMode;

  /** If true, a correct answer rewards the team with a random Green Card. */
  isGreenCardReward: boolean;
  createdAt: number;
}
