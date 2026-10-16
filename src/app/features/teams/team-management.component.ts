import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ClassService } from '../../core/services/class.service';
import { TeamService, TeamWithDetails } from '../../core/services/team.service';
import { I18nService } from '../../core/services/i18n.service';
import { TeamMember } from '../../core/models/team.model';
import { generateId } from '../../core/utils';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-team-management',
  imports: [FormsModule, LanguageSwitcherComponent],
  templateUrl: './team-management.component.html',
})
export class TeamManagementComponent implements OnInit {
  classId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private teamService = inject(TeamService);
  private confirmationService = inject(ConfirmationService);

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  readonly teams = this.teamService.teams;

  readonly teamsDetails = computed(() => {
    this.teams();
    return this.teamService.getTeamsWithDetails(this.classId());
  });

  readonly showAddModal = signal(false);
  newTeamName = '';
  newLeaderName = '';
  newMemberNamesInput = '';

  readonly editingTeam = signal<TeamWithDetails | null>(null);
  editingTeamName = '';
  editingMembers: TeamMember[] = [];
  newSingleMemberName = '';

  readonly adjustingTeam = signal<TeamWithDetails | null>(null);

  ngOnInit(): void {
    this.teamService.loadTeams(this.classId());
  }

  goBack(): void {
    this.router.navigate(['/classes', this.classId()]);
  }

  openAddTeamModal(): void {
    this.newTeamName = '';
    this.newLeaderName = '';
    this.newMemberNamesInput = '';
    this.showAddModal.set(true);
  }

  createTeam(): void {
    if (!this.newTeamName.trim()) return;

    const members = this.newMemberNamesInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    this.teamService.createTeam(
      this.classId(),
      this.newTeamName.trim(),
      members,
      this.newLeaderName.trim()
    );

    this.showAddModal.set(false);
  }

  addPresetTeams(): void {
    const isAr = this.i18n.lang() === 'ar';
    const presets = isAr
      ? [
          { name: 'فريق الصقور', leader: 'أحمد', members: ['خالد', 'سارة', 'ريم'] },
          { name: 'فريق الأبطال', leader: 'عمر', members: ['ليلى', 'يوسف', 'فاطمة'] },
          { name: 'فريق الفرسان', leader: 'سلمان', members: ['مريم', 'زياد', 'نور'] },
          { name: 'فريق النجوم', leader: 'طارق', members: ['منى', 'حمزة', 'هدى'] },
        ]
      : [
          { name: 'Team Alpha', leader: 'Liam', members: ['Lucas', 'Ava', 'Mia'] },
          { name: 'Team Phoenix', leader: 'Alex', members: ['Maya', 'Leo', 'Sofia'] },
          { name: 'Team Titans', leader: 'Ethan', members: ['Emma', 'Noah', 'Zoe'] },
          { name: 'Team Eagles', leader: 'Daniel', members: ['Chloe', 'Oliver', 'Grace'] },
        ];

    for (const p of presets) {
      this.teamService.createTeam(this.classId(), p.name, p.members, p.leader);
    }
  }

  openEditMembers(detail: TeamWithDetails): void {
    this.editingTeam.set(detail);
    this.editingTeamName = detail.team.name;
    this.editingMembers = detail.members.map(m => ({ ...m }));
    this.newSingleMemberName = '';
  }

  setLeader(memberId: string): void {
    this.editingMembers = this.editingMembers.map(m => ({
      ...m,
      isLeader: m.id === memberId,
    }));
  }

  removeMember(index: number): void {
    this.editingMembers.splice(index, 1);
  }

  addSingleMember(): void {
    const name = this.newSingleMemberName.trim();
    if (!name || !this.editingTeam()) return;

    this.editingMembers.push({
      id: generateId(),
      teamId: this.editingTeam()!.team.id,
      name,
      isLeader: this.editingMembers.length === 0,
    });
    this.newSingleMemberName = '';
  }

  saveEditedMembers(): void {
    const detail = this.editingTeam();
    if (!detail) return;

    if (this.editingTeamName.trim() !== detail.team.name) {
      this.teamService.updateTeamName(detail.team.id, this.classId(), this.editingTeamName.trim());
    }

    this.teamService.saveMembers(detail.team.id, this.editingMembers);
    this.teamService.loadTeams(this.classId());
    this.editingTeam.set(null);
  }

  customDeltaValue: number | null = null;
  customExactScore: number | null = null;

  openAdjustScoreModal(detail: TeamWithDetails): void {
    this.customDeltaValue = null;
    this.customExactScore = null;
    this.adjustingTeam.set(detail);
  }

  closeAdjustScoreModal(): void {
    this.adjustingTeam.set(null);
  }

  applyScoreDelta(delta: number): void {
    const target = this.adjustingTeam();
    if (!target) return;
    this.teamService.updateScore(target.team.id, this.classId(), delta);
    const updated = this.teamService.getTeamsWithDetails(this.classId()).find(t => t.team.id === target.team.id);
    if (updated) this.adjustingTeam.set(updated);
    Swal.fire({
      icon: 'success',
      title: (delta > 0 ? `+${delta}` : `${delta}`) + ` ${this.i18n.t('questions.points')}`,
      text: this.i18n.t('teams.pointsAdjusted'),
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top',
    });
  }

  applyCustomDelta(): void {
    if (this.customDeltaValue === null || isNaN(this.customDeltaValue) || this.customDeltaValue === 0) return;
    const delta = Number(this.customDeltaValue);
    this.applyScoreDelta(delta);
    this.customDeltaValue = null;
  }

  applyExactScore(): void {
    const target = this.adjustingTeam();
    if (!target || this.customExactScore === null || isNaN(this.customExactScore)) return;
    const score = Number(this.customExactScore);
    this.teamService.setScore(target.team.id, this.classId(), score);
    const updated = this.teamService.getTeamsWithDetails(this.classId()).find(t => t.team.id === target.team.id);
    if (updated) this.adjustingTeam.set(updated);
    this.customExactScore = null;
    Swal.fire({
      icon: 'success',
      title: `${score} ${this.i18n.t('questions.points')}`,
      text: this.i18n.t('teams.pointsAdjusted'),
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top',
    });
  }

  confirmDeleteTeam(teamId: string, teamName: string): void {
    this.confirmationService.confirm({
      header: this.i18n.t('teams.deleteTeamTitle'),
      message: this.i18n.t('teams.deleteTeamMessage', { name: teamName }),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.teamService.deleteTeam(teamId, this.classId());
      },
    });
  }
}
