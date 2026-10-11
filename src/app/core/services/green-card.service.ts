import { Injectable, inject } from '@angular/core';
import { DataSource } from '../data/data-source';
import { PowerCard, PowerCardType, GreenCardSource, CardEvent, ALL_CARD_TYPES } from '../models/power-card.model';
import { Team } from '../models/team.model';
import { generateId, now } from '../utils';

/**
 * Result of attempting to assign a card to a team.
 */
export interface CardAssignResult {
  success: boolean;
  card: PowerCard | null;
  /** If failed because team already has a card */
  existingCard: PowerCard | null;
  message: string;
}

/**
 * Result of using the Steal 30 Points card.
 */
export interface StealResult {
  stolenAmount: number;
  fromTeamId: string;
  toTeamId: string;
}

/**
 * GreenCardService — pure gameplay logic for the Green Card system.
 *
 * This service handles:
 * - Random card assignment at session start
 * - Card grants by teacher
 * - Card usage validation
 * - Card effect application (double_points scoring is in GameplayService)
 * - Steal points transfers
 * - Extra time additions
 * - Reward question card assignments
 * - Session history recording
 *
 * This service does NOT handle UI concerns — components call this service
 * and display appropriate feedback based on the results.
 */
@Injectable({ providedIn: 'root' })
export class GreenCardService {
  private dataSource = inject(DataSource);

  // ── Random Card Selection ────────────────────────────────

  /** Pick a random card type from all available types. */
  randomCardType(): PowerCardType {
    const idx = Math.floor(Math.random() * ALL_CARD_TYPES.length);
    return ALL_CARD_TYPES[idx];
  }

  // ── Session Start: Assign Initial Cards ──────────────────

  /**
   * Assign one random Green Card to every team for a session.
   * Idempotent: if cards already exist for this session, does nothing.
   * Returns true if cards were assigned, false if already initialized.
   */
  assignStartingCards(sessionId: string, teams: Team[]): boolean {
    const existing = this.dataSource.getCardsBySession(sessionId);
    if (existing.length > 0) {
      // Already initialized — do not re-roll
      return false;
    }

    const timestamp = now();
    for (const team of teams) {
      const card: PowerCard = {
        id: generateId(),
        sessionId,
        teamId: team.id,
        cardType: this.randomCardType(),
        source: 'session_start',
        isUsed: false,
        rewardQuestionId: null,
        earnedAt: timestamp,
      };
      this.dataSource.saveCard(card);

      // Log assignment event
      this.logCardEvent(sessionId, team.id, card.cardType, 'assigned', {
        source: 'session_start',
      });
    }
    return true;
  }

  // ── Get Team's Active Card ───────────────────────────────

  /** Get the active (unused) card for a team in a session, or null. */
  getActiveCard(teamId: string, sessionId: string): PowerCard | null {
    return this.dataSource.getActiveCardForTeamInSession(teamId, sessionId);
  }

  /** Get all cards for a session (used and unused). */
  getSessionCards(sessionId: string): PowerCard[] {
    return this.dataSource.getCardsBySession(sessionId);
  }

  // ── Teacher Grant ────────────────────────────────────────

  /**
   * Grant a specific card type to a team.
   * Returns a result indicating success or if the team already has a card.
   * If the team already has a card, the caller must explicitly call
   * replaceCard() to confirm the replacement.
   */
  grantCard(
    sessionId: string,
    teamId: string,
    cardType: PowerCardType,
  ): CardAssignResult {
    const existingCard = this.getActiveCard(teamId, sessionId);

    if (existingCard) {
      return {
        success: false,
        card: null,
        existingCard,
        message: 'Team already has a Green Card. Replace it or cancel.',
      };
    }

    const card = this.createCard(sessionId, teamId, cardType, 'teacher_grant');

    this.logCardEvent(sessionId, teamId, cardType, 'granted', {
      source: 'teacher_grant',
    });

    return {
      success: true,
      card,
      existingCard: null,
      message: 'Green Card granted successfully.',
    };
  }

  /**
   * Replace an existing card with a new one (teacher-confirmed replacement).
   */
  replaceCard(
    sessionId: string,
    teamId: string,
    newCardType: PowerCardType,
  ): PowerCard {
    const existingCard = this.getActiveCard(teamId, sessionId);
    const replacedType = existingCard?.cardType ?? null;

    // Remove the old card
    if (existingCard) {
      this.dataSource.deleteCard(existingCard.id);
    }

    // Create new card
    const card = this.createCard(sessionId, teamId, newCardType, 'teacher_grant');

    // Log replacement event
    this.logCardEvent(sessionId, teamId, newCardType, 'replaced', {
      source: 'teacher_grant',
      replacedCardType: replacedType,
    });

    return card;
  }

  // ── Reward Question Card ─────────────────────────────────

  /**
   * Try to award a random Green Card for correctly answering a reward question.
   * Returns the result — may fail if team already has a card.
   */
  awardRewardCard(
    sessionId: string,
    teamId: string,
    questionId: string,
  ): CardAssignResult {
    // Check if this reward was already processed (idempotency)
    const events = this.dataSource.getCardEventsBySession(sessionId);
    const alreadyRewarded = events.some(
      e => e.eventType === 'assigned' && e.source === 'reward_question' && e.teamId === teamId
        && this.getCardForRewardQuestion(sessionId, questionId, teamId) !== null
    );

    if (alreadyRewarded) {
      return {
        success: false,
        card: null,
        existingCard: null,
        message: 'Reward already processed for this question.',
      };
    }

    const existingCard = this.getActiveCard(teamId, sessionId);
    if (existingCard) {
      return {
        success: false,
        card: null,
        existingCard,
        message: 'Team already has a Green Card and cannot receive another one.',
      };
    }

    const cardType = this.randomCardType();
    const card = this.createCard(sessionId, teamId, cardType, 'reward_question', questionId);

    this.logCardEvent(sessionId, teamId, cardType, 'assigned', {
      source: 'reward_question',
    });

    return {
      success: true,
      card,
      existingCard: null,
      message: `Reward Card earned: ${cardType}`,
    };
  }

  // ── Card Usage ───────────────────────────────────────────

  /**
   * Mark a card as used. Called by GameplayService after applying the effect.
   */
  markCardUsed(card: PowerCard): void {
    this.dataSource.saveCard({
      ...card,
      isUsed: true,
    });
  }

  // ── Steal Points ─────────────────────────────────────────

  /**
   * Execute the Steal 30 Points effect.
   * Deducts up to 30 from target, adds same amount to user.
   * Returns the actual amount stolen.
   */
  executeStealPoints(
    sessionId: string,
    card: PowerCard,
    usingTeam: Team,
    targetTeam: Team,
  ): StealResult {
    const maxSteal = 30;
    const actualSteal = Math.min(maxSteal, Math.max(0, targetTeam.totalScore));

    // Update target team score
    const updatedTarget: Team = {
      ...targetTeam,
      totalScore: targetTeam.totalScore - actualSteal,
    };
    this.dataSource.saveTeam(updatedTarget);

    // Update using team score
    const updatedUser: Team = {
      ...usingTeam,
      totalScore: usingTeam.totalScore + actualSteal,
    };
    this.dataSource.saveTeam(updatedUser);

    // Mark card as used
    this.markCardUsed(card);

    // Log the event
    this.logCardEvent(sessionId, usingTeam.id, 'steal_points', 'used', {
      targetTeamId: targetTeam.id,
      pointsTransferred: actualSteal,
    });

    return {
      stolenAmount: actualSteal,
      fromTeamId: targetTeam.id,
      toTeamId: usingTeam.id,
    };
  }

  // ── Extra Time ───────────────────────────────────────────

  /**
   * Record the Extra Time card usage. The actual timer update is done by
   * GameplayService/TimerService. This handles card consumption and logging.
   */
  executeExtraTime(
    sessionId: string,
    card: PowerCard,
    teamId: string,
    extraSeconds: number,
    questionIndex: number,
  ): void {
    this.markCardUsed(card);

    this.logCardEvent(sessionId, teamId, 'extra_time', 'used', {
      extraSecondsAdded: extraSeconds,
      questionIndex,
    });
  }

  /**
   * Record the Double Points card usage. Scoring is handled by GameplayService.
   */
  executeDoublePoints(
    sessionId: string,
    card: PowerCard,
    teamId: string,
    questionIndex: number,
  ): void {
    this.markCardUsed(card);

    this.logCardEvent(sessionId, teamId, 'double_points', 'used', {
      questionIndex,
    });
  }

  // ── Session Events / History ─────────────────────────────

  getSessionEvents(sessionId: string): CardEvent[] {
    return this.dataSource.getCardEventsBySession(sessionId);
  }

  // ── Private Helpers ──────────────────────────────────────

  private createCard(
    sessionId: string,
    teamId: string,
    cardType: PowerCardType,
    source: GreenCardSource,
    rewardQuestionId?: string,
  ): PowerCard {
    const card: PowerCard = {
      id: generateId(),
      sessionId,
      teamId,
      cardType,
      source,
      isUsed: false,
      rewardQuestionId: rewardQuestionId ?? null,
      earnedAt: now(),
    };
    this.dataSource.saveCard(card);
    return card;
  }

  private getCardForRewardQuestion(
    sessionId: string,
    questionId: string,
    teamId: string,
  ): PowerCard | null {
    const cards = this.dataSource.getCardsBySession(sessionId);
    return cards.find(
      c => c.rewardQuestionId === questionId && c.teamId === teamId
    ) ?? null;
  }

  private logCardEvent(
    sessionId: string,
    teamId: string,
    cardType: PowerCardType,
    eventType: CardEvent['eventType'],
    extras: Partial<CardEvent> = {},
  ): void {
    const event: CardEvent = {
      id: generateId(),
      sessionId,
      teamId,
      cardType,
      eventType,
      targetTeamId: extras.targetTeamId ?? null,
      pointsTransferred: extras.pointsTransferred ?? null,
      extraSecondsAdded: extras.extraSecondsAdded ?? null,
      questionIndex: extras.questionIndex ?? null,
      source: extras.source ?? null,
      replacedCardType: extras.replacedCardType ?? null,
      timestamp: now(),
    };
    this.dataSource.saveCardEvent(event);
  }
}
