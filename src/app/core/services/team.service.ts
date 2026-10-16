import { Injectable, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { Team, TeamMember } from '../models/team.model';
import { generateId, now } from '../utils';

export interface TeamWithDetails {
  team: Team;
  members: TeamMember[];
}


@Injectable({ providedIn: 'root' })
export class TeamService {
  private dataSource = inject(DataSource);

  private readonly _teams = signal<Team[]>([]);
  readonly teams = this._teams.asReadonly();

  loadTeams(classId: string): void {
    const list = this.dataSource.getTeamsByClass(classId);
    this._teams.set(list);
  }

  getTeamsWithDetails(classId: string): TeamWithDetails[] {
    const teams = this.dataSource.getTeamsByClass(classId);
    return teams.map(team => ({
      team,
      members: this.dataSource.getMembersByTeam(team.id),
    }));
  }

  createTeam(classId: string, name: string, memberNames: string[] = [], leaderName?: string): Team {
    const teamId = generateId();
    const timestamp = now();

    const team: Team = {
      id: teamId,
      classId,
      name: name.trim(),
      totalScore: 0,
      createdAt: timestamp,
    };
    this.dataSource.saveTeam(team);

    const members: TeamMember[] = [];
    if (leaderName && leaderName.trim()) {
      members.push({
        id: generateId(),
        teamId,
        name: leaderName.trim(),
        isLeader: true,
      });
    }

    for (const mName of memberNames) {
      if (mName.trim() && mName.trim() !== leaderName?.trim()) {
        members.push({
          id: generateId(),
          teamId,
          name: mName.trim(),
          isLeader: false,
        });
      }
    }

    this.dataSource.saveMembers(teamId, members);
    this.loadTeams(classId);
    return team;
  }

  updateTeamName(teamId: string, classId: string, newName: string): void {
    const team = this._teams().find(t => t.id === teamId);
    if (!team) return;

    this.dataSource.saveTeam({
      ...team,
      name: newName.trim(),
    });
    this.loadTeams(classId);
  }

  updateScore(teamId: string, classId: string, delta: number): void {
    const team = this._teams().find(t => t.id === teamId) || this.dataSource.getTeamsByClass(classId).find(t => t.id === teamId);
    if (!team) return;

    const updated: Team = {
      ...team,
      totalScore: team.totalScore + delta,
    };
    this.dataSource.saveTeam(updated);
    this.loadTeams(classId);
  }

  setScore(teamId: string, classId: string, newScore: number): void {
    const team = this._teams().find(t => t.id === teamId) || this.dataSource.getTeamsByClass(classId).find(t => t.id === teamId);
    if (!team) return;

    const updated: Team = {
      ...team,
      totalScore: newScore,
    };
    this.dataSource.saveTeam(updated);
    this.loadTeams(classId);
  }

  saveMembers(teamId: string, members: TeamMember[]): void {
    this.dataSource.saveMembers(teamId, members);
  }

  deleteTeam(teamId: string, classId: string): void {
    this.dataSource.deleteTeam(teamId);
    this.loadTeams(classId);
  }
}
