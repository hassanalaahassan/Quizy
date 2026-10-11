/**
 * A Team belongs to one class and persists across sessions.
 * The totalScore accumulates across all sessions.
 */
export interface Team {
  id: string;
  classId: string;
  name: string;
  totalScore: number;
  createdAt: number;
}

/**
 * A member of a team. One member per team is the leader.
 */
export interface TeamMember {
  id: string;
  teamId: string;
  name: string;
  isLeader: boolean;
}
