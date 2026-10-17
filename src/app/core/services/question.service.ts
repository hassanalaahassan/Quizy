import { Injectable, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { PenaltyMode, Question, QuestionOption, QuestionType } from '../models/question.model';
import { BankQuestion } from '../models/question-bank.model';
import { generateId, now } from '../utils';

export interface CreateQuestionDto {
  classId: string;
  category?: string;
  sourceBankQuestionId?: string;
  questionType?: QuestionType;
  text: string;
  options: QuestionOption[];
  correctOptionIndex: number;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  points: number;
  timerSeconds: number;
  penaltyMode: PenaltyMode;
  isGreenCardReward?: boolean;
}

@Injectable({ providedIn: 'root' })
export class QuestionService {
  private dataSource = inject(DataSource);

  private readonly _questions = signal<Question[]>([]);
  readonly questions = this._questions.asReadonly();

  loadQuestions(classId: string): void {
    const list = this.dataSource.getQuestionsByClass(classId);
    // Ensure backward compatibility — old questions without questionType default to 'mcq'
    const normalized = list.map(q => ({
      ...q,
      questionType: q.questionType || 'mcq' as QuestionType,
    }));
    this._questions.set(normalized);
  }

  getQuestionById(questionId: string, classId: string): Question | null {
    const all = this.dataSource.getQuestionsByClass(classId);
    const found = all.find(q => q.id === questionId) ?? null;
    if (found && !found.questionType) {
      (found as Question).questionType = 'mcq';
    }
    return found;
  }

  createQuestion(dto: CreateQuestionDto): Question {
    if (!dto.text.trim()) throw new Error('Question text is required');

    const qType = dto.questionType || 'mcq';

    // Type-specific validation
    switch (qType) {
      case 'mcq':
        if (dto.options.length < 2) throw new Error('At least 2 options are required');
        if (dto.correctOptionIndex < 0 || dto.correctOptionIndex >= dto.options.length) {
          throw new Error('Please select a valid correct answer');
        }
        break;
      case 'true_false':
        // Options are auto-generated (True / False), correctOptionIndex must be 0 or 1
        if (dto.correctOptionIndex !== 0 && dto.correctOptionIndex !== 1) {
          throw new Error('Please select the correct answer (True or False)');
        }
        break;
      case 'short_answer':
      case 'complete':
        if (!dto.correctAnswer || !dto.correctAnswer.trim()) {
          throw new Error('Please provide the correct answer');
        }
        break;
    }

    if (dto.points <= 0) throw new Error('Points must be greater than 0');
    if (dto.timerSeconds <= 0) throw new Error('Timer must be greater than 0 seconds');

    const question: Question = {
      id: generateId(),
      classId: dto.classId,
      questionType: qType,
      text: dto.text.trim(),
      options: qType === 'true_false'
        ? [{ text: 'True' }, { text: 'False' }]
        : (qType === 'mcq' ? dto.options.map(o => ({ text: o.text.trim() })) : []),
      correctOptionIndex: (qType === 'short_answer' || qType === 'complete') ? -1 : dto.correctOptionIndex,
      correctAnswer: (qType === 'short_answer' || qType === 'complete') ? dto.correctAnswer?.trim() : undefined,
      acceptedAnswers: (qType === 'short_answer' || qType === 'complete')
        ? (dto.acceptedAnswers || []).map(a => a.trim()).filter(a => a.length > 0)
        : undefined,
      points: dto.points,
      timerSeconds: dto.timerSeconds,
      penaltyMode: dto.penaltyMode,
      isGreenCardReward: dto.isGreenCardReward ?? false,
      category: dto.category?.trim() || 'General',
      sourceBankQuestionId: dto.sourceBankQuestionId,
      createdAt: now(),
    };

    this.dataSource.saveQuestion(question);
    this.loadQuestions(dto.classId);
    return question;
  }

  updateQuestion(question: Question): void {
    // Ensure questionType is set
    if (!question.questionType) {
      question.questionType = 'mcq';
    }
    this.dataSource.saveQuestion(question);
    this.loadQuestions(question.classId);
  }

  deleteQuestion(questionId: string, classId: string): void {
    this.dataSource.deleteQuestion(questionId);
    this.loadQuestions(classId);
  }

  /**
   * Import questions from Central Bank into a classroom as independent copies.
   * Prevents accidental duplicates by checking sourceBankQuestionId and question text.
   * Returns count of newly imported questions.
   */
  importQuestionsFromBank(classId: string, bankQuestions: BankQuestion[]): number {
    const existing = this.dataSource.getQuestionsByClass(classId);
    const existingBankIds = new Set(existing.map(q => q.sourceBankQuestionId).filter(Boolean));
    const existingTexts = new Set(existing.map(q => q.text.trim().toLowerCase()));

    let importedCount = 0;
    const timestamp = now();

    for (const bq of bankQuestions) {
      // Guard against duplicate import in this classroom
      if (existingBankIds.has(bq.id) || existingTexts.has(bq.text.trim().toLowerCase())) {
        continue;
      }

      const copy: Question = {
        id: generateId(), // independent ID
        classId,
        questionType: bq.questionType,
        text: bq.text,
        options: bq.options ? bq.options.map(o => ({ text: o.text })) : [],
        correctOptionIndex: bq.correctOptionIndex,
        correctAnswer: bq.correctAnswer,
        acceptedAnswers: bq.acceptedAnswers ? [...bq.acceptedAnswers] : undefined,
        points: bq.points,
        timerSeconds: bq.timerSeconds,
        penaltyMode: bq.penaltyMode,
        isGreenCardReward: bq.isGreenCardReward,
        category: bq.category || 'General',
        sourceBankQuestionId: bq.id,
        createdAt: timestamp,
      };

      this.dataSource.saveQuestion(copy);
      existingBankIds.add(bq.id);
      existingTexts.add(bq.text.trim().toLowerCase());
      importedCount++;
    }

    this.loadQuestions(classId);
    return importedCount;
  }
}
