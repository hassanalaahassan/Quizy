/**
 * Available Green Card types.
 * - double_points: doubles question points on correct answer
 * - steal_points:  steals up to 30 points from a target team
 * - extra_time:    adds configurable seconds to the active question timer
 */
export type PowerCardType = 'double_points' | 'steal_points' | 'extra_time';

/** How the card was obtained. */
export type GreenCardSource = 'session_start' | 'reward_question' | 'teacher_grant';

/**
 * Green Card labels and descriptions for UI display.
 */
export const POWER_CARD_INFO: Record<PowerCardType, { label: string; description: string; icon: string }> = {
  double_points: {
    label: 'Double Question Points',
    description: 'Doubles the points awarded for a correctly answered question.',
    icon: 'pi pi-bolt',
  },
  steal_points: {
    label: 'Steal 30 Points',
    description: 'Steals up to 30 points from another team and adds them to yours.',
    icon: 'pi pi-arrow-right-arrow-left',
  },
  extra_time: {
    label: 'Extra Question Time',
    description: 'Adds additional seconds to the active question timer.',
    icon: 'pi pi-clock',
  },
};

/** All available card types for random selection. */
export const ALL_CARD_TYPES: PowerCardType[] = ['double_points', 'steal_points', 'extra_time'];

/**
 * A Green Card owned by a team within a session. Each team can hold at most one.
 */
export interface PowerCard {
  id: string;
  sessionId: string;
  teamId: string;
  cardType: PowerCardType;
  source: GreenCardSource;
  isUsed: boolean;
  /** Question ID that awarded this card (for reward_question source). */
  rewardQuestionId: string | null;
  earnedAt: number;
}

/**
 * Log entry when a Green Card is activated during a session.
 * Captures all effect details for history and auditability.
 */
export interface CardEvent {
  id: string;
  sessionId: string;
  teamId: string;
  cardType: PowerCardType;
  eventType: 'assigned' | 'used' | 'granted' | 'replaced';
  /** Target team for steal_points. */
  targetTeamId: string | null;
  /** Actual points transferred (for steal_points, may be < 30). */
  pointsTransferred: number | null;
  /** Extra seconds added (for extra_time). */
  extraSecondsAdded: number | null;
  /** Question index at time of use. */
  questionIndex: number | null;
  /** Source of the card assignment. */
  source: GreenCardSource | null;
  /** The card that was replaced, if any. */
  replacedCardType: PowerCardType | null;
  timestamp: number;
}
