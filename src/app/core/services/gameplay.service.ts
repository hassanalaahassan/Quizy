import { Injectable, computed, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { TimerService } from './timer.service';
import { GreenCardService } from './green-card.service';
import { Session, SessionQuestionState, QuestionResult, SessionStatus } from '../models/session.model';
import { Question } from '../models/question.model';
import { Team } from '../models/team.model';
import { PowerCard, PowerCardType, CardEvent } from '../models/power-card.model';
import { generateId, now } from '../utils';

export interface EvaluationOutcome {
  teamId: string;
  teamName: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  /** For text-based question types (short_answer / complete). */
  textAnswer?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  powerCardApplied: PowerCardType | null;
  /** If a reward card was earned for this question */
  rewardCardEarned: PowerCard | null;
  /** Message about reward card (e.g. team already has one) */
  rewardCardMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class GameplayService {
  private dataSource = inject(DataSource);
  readonly timerService = inject(TimerService);
  private greenCardService = inject(GreenCardService);

  // Core State Signals
  private readonly _session = signal<Session | null>(null);
  private readonly _questions = signal<Question[]>([]);
  private readonly _questionStates = signal<SessionQuestionState[]>([]);
  private readonly _teams = signal<Team[]>([]);
  private readonly _results = signal<QuestionResult[]>([]);
  private readonly _currentIndex = signal<number>(0);

  // Green Card state for the current session
  private readonly _sessionCards = signal<PowerCard[]>([]);

  // Active question interaction signals
  private readonly _selectedTeamId = signal<string | null>(null);
  private readonly _activeCard = signal<{ teamId: string; cardId: string; cardType: PowerCardType } | null>(null);
  private readonly _lastOutcome = signal<EvaluationOutcome | null>(null);
  private readonly _isAnswerSubmitted = signal<boolean>(false);
  private readonly _adjustingTeamId = signal<string | null>(null);

  // Readonly exposures
  readonly session = this._session.asReadonly();
  readonly questions = this._questions.asReadonly();
  readonly questionStates = this._questionStates.asReadonly();
  readonly teams = this._teams.asReadonly();
  readonly results = this._results.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly sessionCards = this._sessionCards.asReadonly();

  readonly selectedTeamId = this._selectedTeamId.asReadonly();
  readonly activeCard = this._activeCard.asReadonly();
  readonly lastOutcome = this._lastOutcome.asReadonly();
  readonly isAnswerSubmitted = this._isAnswerSubmitted.asReadonly();
  readonly adjustingTeamId = this._adjustingTeamId.asReadonly();

  // Computed signals
  readonly currentQuestion = computed(() => {
    const list = this._questions();
    const idx = this._currentIndex();
    return list[idx] ?? null;
  });

  readonly selectedTeam = computed(() => {
    const tid = this._selectedTeamId();
    if (!tid) return null;
    return this._teams().find(t => t.id === tid) ?? null;
  });

  readonly totalQuestionsCount = computed(() => this._questions().length);

  readonly isLastQuestion = computed(() => {
    return this._currentIndex() >= this._questions().length - 1;
  });

  readonly isSessionCompleted = computed(() => {
    return this._session()?.status === 'completed';
  });

  readonly rankedTeams = computed(() => {
    return [...this._teams()].sort((a, b) => b.totalScore - a.totalScore);
  });

  /**
   * Load and initialize an active or paused session.
   * Restores state seamlessly (Section 10 requirement).
   */
  initSession(classId: string, sessionId: string): boolean {
    const sessions = this.dataSource.getSessionsByClass(classId);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return false;

    // Load questions according to session questionIds order
    const allQuestions = this.dataSource.getQuestionsByClass(classId);
    const orderedQuestions = session.questionIds
      .map(id => allQuestions.find(q => q.id === id))
      .filter((q): q is Question => q !== undefined);

    // Load question states
    const states = this.dataSource.getSessionQuestionStates(sessionId);

    // Load teams & results
    const teams = this.dataSource.getTeamsByClass(classId);
    const results = this.dataSource.getResultsBySession(sessionId);

    this._session.set(session);
    this._questions.set(orderedQuestions);
    this._questionStates.set(states);
    this._teams.set(teams);
    this._results.set(results);

    // Restore question index
    const restoreIndex = Math.min(session.currentQuestionIndex, Math.max(0, orderedQuestions.length - 1));
    this._currentIndex.set(restoreIndex);

    // Clear transient states
    this._selectedTeamId.set(null);
    this._activeCard.set(null);
    this._lastOutcome.set(null);
    this._isAnswerSubmitted.set(false);

    // If session was not started, mark in_progress
    if (session.status === 'not_started') {
      const updated: Session = {
        ...session,
        status: 'in_progress',
        startedAt: now(),
      };
      this.dataSource.saveSession(updated);
      this._session.set(updated);
    }

    // Assign starting Green Cards (idempotent — won't re-roll if already done)
    this.greenCardService.assignStartingCards(sessionId, teams);

    // Load session cards into signal
    this.refreshSessionCards();

    // Set up timer for the restored question
    const currentQ = orderedQuestions[restoreIndex];
    if (currentQ) {
      const currentState = states.find(s => s.questionId === currentQ.id);
      const remaining = currentState?.timerRemainingSeconds ?? currentQ.timerSeconds;
      this.timerService.start(currentQ.timerSeconds, remaining);
    }

    return true;
  }

  /** Refresh the session cards signal from storage. */
  refreshSessionCards(): void {
    const session = this._session();
    if (!session) return;
    this._sessionCards.set(this.greenCardService.getSessionCards(session.id));
  }

  /** Refresh teams from storage (call after score changes). */
  refreshTeams(): void {
    const session = this._session();
    if (!session) return;
    this._teams.set(this.dataSource.getTeamsByClass(session.classId));
  }

  /** Adjust team score by a delta (positive or negative). */
  adjustTeamScore(teamId: string, delta: number): void {
    const session = this._session();
    if (!session) return;
    const team = this._teams().find(t => t.id === teamId);
    if (!team) return;

    const updated: Team = {
      ...team,
      totalScore: team.totalScore + delta,
    };
    this.dataSource.saveTeam(updated);
    this._teams.update(list => list.map(t => t.id === teamId ? updated : t));
  }

  /** Set team score to an exact value. */
  setTeamScore(teamId: string, newScore: number): void {
    const session = this._session();
    if (!session) return;
    const team = this._teams().find(t => t.id === teamId);
    if (!team) return;

    const updated: Team = {
      ...team,
      totalScore: newScore,
    };
    this.dataSource.saveTeam(updated);
    this._teams.update(list => list.map(t => t.id === teamId ? updated : t));
  }

  openAdjustPointsModal(teamId?: string): void {
    const targetId = teamId || this._selectedTeamId() || this._teams()[0]?.id || null;
    this._adjustingTeamId.set(targetId);
  }

  closeAdjustPointsModal(): void {
    this._adjustingTeamId.set(null);
  }

  selectTeam(teamId: string): void {
    if (this._isAnswerSubmitted()) return;
    this._selectedTeamId.set(teamId);
  }

  playPowerCard(teamId: string, cardId: string, cardType: PowerCardType): void {
    if (this._isAnswerSubmitted()) return;
    this._activeCard.set({ teamId, cardId, cardType });
  }

  cancelPowerCard(): void {
    if (this._isAnswerSubmitted()) return;
    this._activeCard.set(null);
  }

  /** Get the active (unused) card for a team in the current session. */
  getTeamActiveCard(teamId: string): PowerCard | null {
    const session = this._session();
    if (!session) return null;
    return this.greenCardService.getActiveCard(teamId, session.id);
  }

  /**
   * Submit answer selected by the teacher based on student verbal response.
   * Works for MCQ and True/False question types.
   */
  submitAnswer(selectedOptionIndex: number): EvaluationOutcome | null {
    const session = this._session();
    const question = this.currentQuestion();
    const teamId = this._selectedTeamId();

    if (!session || !question || !teamId || this._isAnswerSubmitted()) {
      return null;
    }

    const qType = question.questionType || 'mcq';
    if (qType === 'short_answer' || qType === 'complete') {
      // Text-based types should use submitTextAnswer instead
      return null;
    }

    // Pause timer on submission
    this.timerService.pause();

    const team = this._teams().find(t => t.id === teamId);
    const teamName = team ? team.name : 'Selected Team';

    const isCorrect = selectedOptionIndex === question.correctOptionIndex;

    return this._evaluateAndPersist(session, question, teamId, teamName, team ?? null, isCorrect, selectedOptionIndex);
  }

  /**
   * Submit a text answer for short_answer and complete question types.
   * Can be auto-checked or overridden directly by the teacher.
   */
  submitTextAnswer(textAnswer: string, teacherOverride?: boolean): EvaluationOutcome | null {
    const session = this._session();
    const question = this.currentQuestion();
    const teamId = this._selectedTeamId();

    if (!session || !question || !teamId || this._isAnswerSubmitted()) {
      return null;
    }

    const qType = question.questionType || 'mcq';
    if (qType !== 'short_answer' && qType !== 'complete') {
      return null;
    }

    // Pause timer on submission
    this.timerService.pause();

    const team = this._teams().find(t => t.id === teamId);
    const teamName = team ? team.name : 'Selected Team';

    let isCorrect: boolean;
    if (teacherOverride !== undefined) {
      isCorrect = teacherOverride;
    } else {
      // Check correctness (case-insensitive)
      const normalizedAnswer = textAnswer.trim().toLowerCase();
      const correctAnswer = (question.correctAnswer || '').trim().toLowerCase();
      const accepted = (question.acceptedAnswers || []).map(a => a.trim().toLowerCase());
      isCorrect = normalizedAnswer === correctAnswer || accepted.includes(normalizedAnswer);
    }

    return this._evaluateAndPersist(session, question, teamId, teamName, team ?? null, isCorrect, -1, textAnswer.trim());
  }

  /**
   * Submit teacher direct verdict (Correct or Incorrect) for the currently selected team.
   * Works for any question type (MCQ, True/False, Short Answer, Complete).
   */
  submitVerdict(isCorrect: boolean, selectedOptionIndex: number = -1, textAnswer: string = ''): EvaluationOutcome | null {
    const session = this._session();
    const question = this.currentQuestion();
    const teamId = this._selectedTeamId();

    if (!session || !question || !teamId || this._isAnswerSubmitted()) {
      return null;
    }

    this.timerService.pause();

    const team = this._teams().find(t => t.id === teamId);
    const teamName = team ? team.name : 'Selected Team';

    let optIdx = selectedOptionIndex;
    if (optIdx < 0 && question.options && question.options.length > 0) {
      optIdx = isCorrect ? question.correctOptionIndex : (question.correctOptionIndex === 0 ? 1 : 0);
    }

    return this._evaluateAndPersist(session, question, teamId, teamName, team ?? null, isCorrect, optIdx, textAnswer || undefined);
  }

  /**
   * Override the outcome of the currently evaluated question.
   * Allows the teacher to switch from wrong to right (or vice-versa),
   * automatically correcting points, updating the database, and updating rewards.
   */
  overrideLastOutcome(newIsCorrect: boolean): EvaluationOutcome | null {
    const session = this._session();
    const question = this.currentQuestion();
    const currentOutcome = this._lastOutcome();

    if (!session || !question || !currentOutcome || currentOutcome.isCorrect === newIsCorrect) {
      return null;
    }

    const team = this._teams().find(t => t.id === currentOutcome.teamId);
    if (!team) return null;

    // Calculate new points to award
    let newPoints = 0;
    const cardApplied = currentOutcome.powerCardApplied;

    if (newIsCorrect) {
      let pts = question.points;
      if (cardApplied === 'double_points') {
        pts *= 2;
      }
      newPoints = pts;
    } else {
      if (question.penaltyMode === 'deduct') {
        newPoints = -question.points;
      } else {
        newPoints = 0;
      }
    }

    const scoreDelta = newPoints - currentOutcome.pointsAwarded;

    // 1. Update Team Score
    const updatedTeam: Team = {
      ...team,
      totalScore: team.totalScore + scoreDelta,
    };
    this.dataSource.saveTeam(updatedTeam);
    this._teams.update(list => list.map(t => t.id === team.id ? updatedTeam : t));

    // 2. Update QuestionResult in DataSource and signal
    const existingResults = this._results();
    const targetResult = existingResults.find(
      r => r.sessionId === session.id && r.questionId === question.id && r.teamId === team.id
    );

    let newSelectedOpt = currentOutcome.selectedOptionIndex;
    if (newIsCorrect && newSelectedOpt < 0 && question.options && question.options.length > 0) {
      newSelectedOpt = question.correctOptionIndex;
    }

    if (targetResult) {
      const updatedResult: QuestionResult = {
        ...targetResult,
        isCorrect: newIsCorrect,
        pointsAwarded: newPoints,
        selectedOptionIndex: newSelectedOpt,
      };
      this.dataSource.saveResult(updatedResult);
      this._results.update(list => list.map(r => r.id === targetResult.id ? updatedResult : r));
    }

    // 3. Handle Green Card Reward
    let rewardCardEarned = currentOutcome.rewardCardEarned;
    let rewardCardMessage = currentOutcome.rewardCardMessage;

    if (newIsCorrect && question.isGreenCardReward && !rewardCardEarned) {
      const rewardResult = this.greenCardService.awardRewardCard(session.id, team.id, question.id);
      if (rewardResult.success) {
        rewardCardEarned = rewardResult.card;
        rewardCardMessage = rewardResult.message;
      } else {
        rewardCardMessage = rewardResult.message;
      }
      this.refreshSessionCards();
    } else if (!newIsCorrect && rewardCardEarned) {
      this.dataSource.deleteCard(rewardCardEarned.id);
      rewardCardEarned = null;
      rewardCardMessage = null;
      this.refreshSessionCards();
    }

    // 4. Update last outcome
    const updatedOutcome: EvaluationOutcome = {
      ...currentOutcome,
      isCorrect: newIsCorrect,
      selectedOptionIndex: newSelectedOpt,
      pointsAwarded: newPoints,
      rewardCardEarned,
      rewardCardMessage,
    };

    this._lastOutcome.set(updatedOutcome);
    return updatedOutcome;
  }

  /**
   * Core evaluation logic shared between MCQ/TF and text-based question types.
   */
  private _evaluateAndPersist(
    session: Session,
    question: Question,
    teamId: string,
    teamName: string,
    team: Team | null,
    isCorrect: boolean,
    selectedOptionIndex: number,
    textAnswer?: string
  ): EvaluationOutcome {
    const card = this._activeCard();
    let pointsAwarded = 0;
    let cardApplied: PowerCardType | null = null;

    if (isCorrect) {
      let pts = question.points;
      if (card && card.teamId === teamId && card.cardType === 'double_points') {
        pts *= 2;
        cardApplied = 'double_points';

        // Consume the card
        const actualCard = this.getTeamActiveCard(teamId);
        if (actualCard) {
          this.greenCardService.executeDoublePoints(
            session.id, actualCard, teamId, this._currentIndex()
          );
        }
      }
      pointsAwarded = pts;
    } else {
      // Wrong answer — double_points card is NOT consumed on wrong answer
      if (question.penaltyMode === 'deduct') {
        pointsAwarded = -question.points;
      } else {
        pointsAwarded = 0;
      }
    }

    // 1. Save QuestionResult
    const currentState = this._questionStates().find(s => s.questionId === question.id);
    const result: QuestionResult = {
      id: generateId(),
      sessionId: session.id,
      sessionQuestionId: currentState?.id || generateId(),
      questionId: question.id,
      teamId,
      selectedOptionIndex,
      textAnswer,
      isCorrect,
      pointsAwarded,
      timestamp: now(),
    };
    this.dataSource.saveResult(result);
    this._results.update(r => [...r, result]);

    // 2. Update Team cumulative score
    if (pointsAwarded !== 0 && team) {
      const updatedTeam: Team = {
        ...team,
        totalScore: team.totalScore + pointsAwarded,
      };
      this.dataSource.saveTeam(updatedTeam);
      this._teams.update(list => list.map(t => t.id === teamId ? updatedTeam : t));
    }

    // 3. Update question state
    const updatedStates = this._questionStates().map(s => {
      if (s.questionId === question.id) {
        return {
          ...s,
          status: 'answered' as const,
          timerRemainingSeconds: this.timerService.remainingSeconds(),
        };
      }
      return s;
    });
    this.dataSource.saveSessionQuestionStates(session.id, updatedStates);
    this._questionStates.set(updatedStates);

    // 4. Handle Green Card Reward Question
    let rewardCardEarned: PowerCard | null = null;
    let rewardCardMessage: string | null = null;

    if (isCorrect && question.isGreenCardReward) {
      const rewardResult = this.greenCardService.awardRewardCard(
        session.id, teamId, question.id
      );
      if (rewardResult.success) {
        rewardCardEarned = rewardResult.card;
        rewardCardMessage = rewardResult.message;
      } else {
        rewardCardMessage = rewardResult.message;
      }
      this.refreshSessionCards();
    }

    const outcome: EvaluationOutcome = {
      teamId,
      teamName,
      selectedOptionIndex,
      correctOptionIndex: question.correctOptionIndex,
      textAnswer,
      isCorrect,
      pointsAwarded,
      powerCardApplied: cardApplied,
      rewardCardEarned,
      rewardCardMessage,
    };

    this._lastOutcome.set(outcome);
    this._isAnswerSubmitted.set(true);

    // Refresh cards signal after any card usage
    this.refreshSessionCards();

    return outcome;
  }

  /**
   * Skip the current question without awarding points.
   */
  skipQuestion(): void {
    const session = this._session();
    const question = this.currentQuestion();
    if (!session || !question) return;

    this.timerService.pause();

    const updatedStates = this._questionStates().map(s => {
      if (s.questionId === question.id) {
        return {
          ...s,
          status: 'skipped' as const,
          timerRemainingSeconds: 0,
        };
      }
      return s;
    });
    this.dataSource.saveSessionQuestionStates(session.id, updatedStates);
    this._questionStates.set(updatedStates);

    this.nextQuestion();
  }

  /**
   * Advance to next question or conclude session.
   */
  nextQuestion(): void {
    const session = this._session();
    if (!session) return;

    const nextIdx = this._currentIndex() + 1;
    const questions = this._questions();

    if (nextIdx >= questions.length) {
      // Session finished!
      this.completeSession();
      return;
    }

    // Advance index and save state
    this._currentIndex.set(nextIdx);
    this._selectedTeamId.set(null);
    this._activeCard.set(null);
    this._lastOutcome.set(null);
    this._isAnswerSubmitted.set(false);

    const updatedSession: Session = {
      ...session,
      currentQuestionIndex: nextIdx,
      status: 'in_progress',
    };
    this.dataSource.saveSession(updatedSession);
    this._session.set(updatedSession);

    // Start timer for the next question
    const nextQ = questions[nextIdx];
    if (nextQ) {
      this.timerService.start(nextQ.timerSeconds);
    }
  }

  /**
   * Pause and save session so the teacher can close the browser and return later (Section 10).
   */
  pauseAndSaveSession(): void {
    const session = this._session();
    const question = this.currentQuestion();
    if (!session) return;

    this.timerService.pause();

    // Save timer remaining on current question state
    if (question) {
      const remaining = this.timerService.remainingSeconds();
      const updatedStates = this._questionStates().map(s => {
        if (s.questionId === question.id) {
          return {
            ...s,
            timerRemainingSeconds: remaining,
          };
        }
        return s;
      });
      this.dataSource.saveSessionQuestionStates(session.id, updatedStates);
      this._questionStates.set(updatedStates);
    }

    const updatedSession: Session = {
      ...session,
      status: 'paused',
      pausedAt: now(),
      currentQuestionIndex: this._currentIndex(),
    };
    this.dataSource.saveSession(updatedSession);
    this._session.set(updatedSession);
  }

  completeSession(): void {
    const session = this._session();
    if (!session) return;

    this.timerService.stop();

    const updated: Session = {
      ...session,
      status: 'completed',
      completedAt: now(),
    };
    this.dataSource.saveSession(updated);
    this._session.set(updated);
  }
}
