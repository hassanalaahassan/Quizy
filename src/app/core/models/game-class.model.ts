/**
 * A Class represents a permanent classroom entity (e.g., "Grade 3A").
 * It groups teams, questions, and sessions together.
 */
export interface GameClass {
  id: string;
  name: string;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
}
