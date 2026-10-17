import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { ExcelService, ExcelParseResult } from '../../core/services/excel.service';
import { I18nService } from '../../core/services/i18n.service';
import { BankQuestion, QuestionGroup } from '../../core/models/question-bank.model';
import { PenaltyMode, QuestionOption, QuestionType } from '../../core/models/question.model';
import { formatTimer, fromTotalSeconds, toTotalSeconds } from '../../core/utils';
import { NavbarComponent, NavAction } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-question-bank-central',
  imports: [FormsModule, NavbarComponent],
  templateUrl: './question-bank-central.component.html',
})
export class QuestionBankCentralComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private bankService = inject(QuestionBankService);
  private excelService = inject(ExcelService);
  private confirmationService = inject(ConfirmationService);

  readonly navActions = computed<NavAction[]>(() => {
    const list: NavAction[] = [
      {
        label: this.i18n.t('bank.templateBtn'),
        icon: 'pi pi-file',
        callback: () => this.downloadSampleTemplate(),
        style: 'ghost',
      },
    ];
    if (this.filteredQuestions().length > 0) {
      list.push({
        label: this.i18n.t('bank.exportExcelBtn'),
        icon: 'pi pi-download',
        callback: () => this.exportCurrentGroupBank(),
        style: 'ghost',
      });
    }
    list.push(
      {
        label: this.i18n.t('bank.uploadExcelBtn'),
        icon: 'pi pi-file-excel',
        callback: () => this.openExcelModal(),
        style: 'secondary',
      },
      {
        label: this.i18n.t('bank.addQuestionBtn'),
        icon: 'pi pi-plus',
        callback: () => this.openCreateQuestionModal(),
        style: 'primary',
        hideOnMobile: false,
      }
    );
    return list;
  });

  // ── Signals from service ──────────────────────────────────
  readonly groups = this.bankService.groups;
  readonly selectedGroupId = this.bankService.selectedGroupId;
  readonly selectedGroup = this.bankService.selectedGroup;
  readonly categories = this.bankService.categories;
  readonly filteredQuestions = this.bankService.filteredQuestions;
  readonly selectedCategory = this.bankService.selectedCategory;
  readonly selectedType = this.bankService.selectedType;

  // ── Local Search & Selection ──────────────────────────────
  searchQuery = '';
  readonly selectedQuestionIds = signal<Set<string>>(new Set());

  // ── Modals State ──────────────────────────────────────────
  readonly showQuestionModal = signal(false);
  readonly editingQuestionId = signal<string | null>(null);
  readonly questionFormError = signal('');

  // Group Modal
  readonly showGroupModal = signal(false);
  readonly editingGroupId = signal<string | null>(null);
  groupFormName = '';
  groupFormDesc = '';
  readonly groupFormError = signal('');

  // Move Modal
  readonly showMoveModal = signal(false);
  moveTargetGroupId = '';

  // Excel Upload Modal
  readonly showExcelModal = signal(false);
  readonly excelLoading = signal(false);
  readonly excelError = signal('');
  readonly excelResult = signal<ExcelParseResult | null>(null);
  excelTargetGroupId = '';
  excelDefaultCategory = 'General';
  excelSkipDuplicates = true;
  readonly excelSuccessSummary = signal<string | null>(null);

  // ── Question Form Fields ──────────────────────────────────
  formQuestionType: QuestionType = 'mcq';
  formCategory = 'General';
  formText = '';
  formOptions: QuestionOption[] = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
  formCorrectIndex = 0;
  formCorrectAnswer = '';
  formAcceptedAnswersText = '';
  formPoints = 20;
  formTimerMinutes = 0;
  formTimerSeconds = 30;
  formPenaltyMode: PenaltyMode = 'none';
  formGreenCardReward = false;

  ngOnInit(): void {
    this.bankService.refreshGroups();
    const grps = this.groups();
    if (grps.length > 0 && !this.selectedGroupId()) {
      this.selectGroup(grps[0].id);
    }
  }

  goBack(): void {
    this.router.navigate(['/classes']);
  }

  selectGroup(groupId: string): void {
    this.selectedQuestionIds.set(new Set());
    this.bankService.selectGroup(groupId);
  }

  onSearchChange(): void {
    this.bankService.setSearchQuery(this.searchQuery);
  }

  onCategorySelect(cat: string | null): void {
    this.bankService.setSelectedCategory(cat);
  }

  onTypeSelect(type: string | null): void {
    this.bankService.setSelectedType(type);
  }

  formatTime(seconds: number): string {
    return formatTimer(seconds);
  }

  // ── Selection & Bulk Actions ──────────────────────────────

  toggleSelectQuestion(id: string): void {
    const set = new Set(this.selectedQuestionIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedQuestionIds.set(set);
  }

  toggleSelectAll(): void {
    const all = this.filteredQuestions();
    const current = this.selectedQuestionIds();
    if (current.size === all.length && all.length > 0) {
      this.selectedQuestionIds.set(new Set());
    } else {
      this.selectedQuestionIds.set(new Set(all.map(q => q.id)));
    }
  }

  isQuestionSelected(id: string): boolean {
    return this.selectedQuestionIds().has(id);
  }

  isAllSelected(): boolean {
    const all = this.filteredQuestions();
    return all.length > 0 && this.selectedQuestionIds().size === all.length;
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedQuestionIds());
    const grpId = this.selectedGroupId();
    if (!grpId || ids.length === 0) return;

    this.confirmationService.confirm({
      header: this.i18n.t('bank.deleteBulkTitle', { count: ids.length }),
      message: this.i18n.t('bank.deleteBulkMessage', { count: ids.length }),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.bankService.deleteBankQuestionsBatch(ids, grpId);
        this.selectedQuestionIds.set(new Set());
      },
    });
  }

  openMoveModal(): void {
    const otherGroups = this.groups().filter(g => g.id !== this.selectedGroupId());
    this.moveTargetGroupId = otherGroups[0]?.id || '';
    this.showMoveModal.set(true);
  }

  closeMoveModal(): void {
    this.showMoveModal.set(false);
  }

  executeMove(): void {
    const ids = Array.from(this.selectedQuestionIds());
    const curGrpId = this.selectedGroupId();
    if (!curGrpId || !this.moveTargetGroupId || ids.length === 0) return;

    this.bankService.moveBankQuestionsBatch(ids, this.moveTargetGroupId, curGrpId);
    this.selectedQuestionIds.set(new Set());
    this.closeMoveModal();
  }

  // ── Group Operations ───────────────────────────────────────

  openCreateGroupModal(): void {
    this.editingGroupId.set(null);
    this.groupFormName = '';
    this.groupFormDesc = '';
    this.groupFormError.set('');
    this.showGroupModal.set(true);
  }

  openEditGroupModal(group: QuestionGroup, event?: Event): void {
    event?.stopPropagation();
    this.editingGroupId.set(group.id);
    this.groupFormName = group.name;
    this.groupFormDesc = group.description || '';
    this.groupFormError.set('');
    this.showGroupModal.set(true);
  }

  closeGroupModal(): void {
    this.showGroupModal.set(false);
    this.groupFormError.set('');
  }

  saveGroup(): void {
    const trimmed = this.groupFormName.trim();
    if (!trimmed) {
      this.groupFormError.set('Group name is required');
      return;
    }

    try {
      const editId = this.editingGroupId();
      if (editId) {
        this.bankService.updateGroup(editId, trimmed, this.groupFormDesc);
      } else {
        this.bankService.createGroup(trimmed, this.groupFormDesc);
      }
      this.closeGroupModal();
    } catch (err: unknown) {
      this.groupFormError.set(err instanceof Error ? err.message : 'Error saving group');
    }
  }

  confirmDeleteGroup(group: QuestionGroup, event?: Event): void {
    event?.stopPropagation();
    this.confirmationService.confirm({
      header: this.i18n.t('bank.deleteGroupTitle', { name: group.name }),
      message: this.i18n.t('bank.deleteGroupMessage', { name: group.name }),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.bankService.deleteGroup(group.id);
      },
    });
  }

  // ── Question Create / Edit Modal ──────────────────────────

  openCreateQuestionModal(): void {
    this.editingQuestionId.set(null);
    this.questionFormError.set('');
    this.formQuestionType = 'mcq';
    this.formCategory = this.selectedCategory() || 'General';
    this.formText = '';
    this.formOptions = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
    this.formCorrectIndex = 0;
    this.formCorrectAnswer = '';
    this.formAcceptedAnswersText = '';
    this.formPoints = 20;
    this.formTimerMinutes = 0;
    this.formTimerSeconds = 30;
    this.formPenaltyMode = 'none';
    this.formGreenCardReward = false;
    this.showQuestionModal.set(true);
  }

  openEditQuestionModal(q: BankQuestion): void {
    this.editingQuestionId.set(q.id);
    this.questionFormError.set('');
    this.formQuestionType = q.questionType || 'mcq';
    this.formCategory = q.category || 'General';
    this.formText = q.text;
    this.formOptions = q.options?.length > 0 ? q.options.map(o => ({ ...o })) : [{ text: '' }, { text: '' }];
    this.formCorrectIndex = q.correctOptionIndex >= 0 ? q.correctOptionIndex : 0;
    this.formCorrectAnswer = q.correctAnswer || '';
    this.formAcceptedAnswersText = (q.acceptedAnswers || []).join(', ');
    this.formPoints = q.points;
    const split = fromTotalSeconds(q.timerSeconds);
    this.formTimerMinutes = split.minutes;
    this.formTimerSeconds = split.seconds;
    this.formPenaltyMode = q.penaltyMode;
    this.formGreenCardReward = q.isGreenCardReward ?? false;
    this.showQuestionModal.set(true);
  }

  closeQuestionModal(): void {
    this.showQuestionModal.set(false);
    this.questionFormError.set('');
  }

  addOption(): void {
    if (this.formOptions.length < 6) {
      this.formOptions.push({ text: '' });
    }
  }

  removeOption(idx: number): void {
    if (this.formOptions.length > 2) {
      this.formOptions.splice(idx, 1);
      if (this.formCorrectIndex >= this.formOptions.length) {
        this.formCorrectIndex = this.formOptions.length - 1;
      }
    }
  }

  setTimer(min: number, sec: number): void {
    this.formTimerMinutes = min;
    this.formTimerSeconds = sec;
  }

  saveQuestion(): void {
    this.questionFormError.set('');
    const text = this.formText.trim();
    if (!text) {
      this.questionFormError.set('Please provide question text');
      return;
    }

    const currentGroupId = this.selectedGroupId();
    if (!currentGroupId) {
      this.questionFormError.set('Please select or create a group first');
      return;
    }

    const qType = this.formQuestionType;
    let filledOptions: QuestionOption[] = [];

    if (qType === 'mcq') {
      filledOptions = this.formOptions.filter(o => o.text.trim().length > 0);
      if (filledOptions.length < 2) {
        this.questionFormError.set('Please provide at least 2 non-empty options');
        return;
      }
      if (this.formCorrectIndex < 0 || this.formCorrectIndex >= filledOptions.length) {
        this.questionFormError.set('Please select which option is correct');
        return;
      }
    } else if (qType === 'true_false') {
      const isAr = this.i18n.lang() === 'ar';
      filledOptions = isAr
        ? [{ text: 'صح' }, { text: 'خطأ' }]
        : [{ text: 'True' }, { text: 'False' }];
      if (this.formCorrectIndex !== 0 && this.formCorrectIndex !== 1) {
        this.formCorrectIndex = 0;
      }
    } else if (qType === 'short_answer' || qType === 'complete') {
      if (!this.formCorrectAnswer.trim()) {
        this.questionFormError.set('Please provide the correct answer');
        return;
      }
    }

    const totalSeconds = toTotalSeconds(this.formTimerMinutes || 0, this.formTimerSeconds || 0);
    if (totalSeconds <= 0) {
      this.questionFormError.set('Timer duration must be greater than 0');
      return;
    }

    if (!this.formPoints || this.formPoints <= 0) {
      this.questionFormError.set('Points must be greater than 0');
      return;
    }

    const acceptedList = this.formAcceptedAnswersText
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    try {
      const editId = this.editingQuestionId();
      if (editId) {
        this.bankService.updateBankQuestion({
          id: editId,
          groupId: currentGroupId,
          category: this.formCategory.trim() || 'General',
          questionType: qType,
          text,
          options: filledOptions,
          correctOptionIndex: (qType === 'short_answer' || qType === 'complete') ? -1 : this.formCorrectIndex,
          correctAnswer: (qType === 'short_answer' || qType === 'complete') ? this.formCorrectAnswer.trim() : undefined,
          acceptedAnswers: (qType === 'short_answer' || qType === 'complete') ? acceptedList : undefined,
          points: this.formPoints,
          timerSeconds: totalSeconds,
          penaltyMode: this.formPenaltyMode,
          isGreenCardReward: this.formGreenCardReward,
          createdAt: Date.now(),
        });
      } else {
        this.bankService.createBankQuestion({
          groupId: currentGroupId,
          category: this.formCategory.trim() || 'General',
          questionType: qType,
          text,
          options: filledOptions,
          correctOptionIndex: (qType === 'short_answer' || qType === 'complete') ? -1 : this.formCorrectIndex,
          correctAnswer: (qType === 'short_answer' || qType === 'complete') ? this.formCorrectAnswer.trim() : undefined,
          acceptedAnswers: (qType === 'short_answer' || qType === 'complete') ? acceptedList : undefined,
          points: this.formPoints,
          timerSeconds: totalSeconds,
          penaltyMode: this.formPenaltyMode,
          isGreenCardReward: this.formGreenCardReward,
        });
      }
      this.closeQuestionModal();
    } catch (err: unknown) {
      this.questionFormError.set(err instanceof Error ? err.message : 'Error saving question');
    }
  }

  confirmDeleteQuestion(q: BankQuestion): void {
    this.confirmationService.confirm({
      header: this.i18n.t('bank.deleteQuestionTitle'),
      message: this.i18n.t('bank.deleteQuestionMessage'),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.bankService.deleteBankQuestion(q.id, q.groupId);
        const set = new Set(this.selectedQuestionIds());
        set.delete(q.id);
        this.selectedQuestionIds.set(set);
      },
    });
  }

  // ── Excel Upload & Import Modal ───────────────────────────

  openExcelModal(): void {
    this.excelTargetGroupId = this.selectedGroupId() || (this.groups()[0]?.id ?? '');
    this.excelDefaultCategory = this.selectedCategory() || 'General';
    this.excelResult.set(null);
    this.excelError.set('');
    this.excelSuccessSummary.set(null);
    this.excelSkipDuplicates = true;
    this.showExcelModal.set(true);
  }

  closeExcelModal(): void {
    this.showExcelModal.set(false);
    this.excelResult.set(null);
    this.excelError.set('');
    this.excelSuccessSummary.set(null);
  }

  async onExcelFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.excelError.set('');
    this.excelLoading.set(true);
    this.excelSuccessSummary.set(null);

    try {
      const existing = this.excelTargetGroupId
        ? this.bankService.getExistingQuestionTexts(this.excelTargetGroupId)
        : [];
      const parsed = await this.excelService.parseQuestionsFile(
        file,
        this.excelDefaultCategory,
        existing
      );
      this.excelResult.set(parsed);
    } catch (err: unknown) {
      this.excelError.set(err instanceof Error ? err.message : 'Error reading Excel file');
      this.excelResult.set(null);
    } finally {
      this.excelLoading.set(false);
      // Reset input value to allow selecting same file again
      input.value = '';
    }
  }

  executeExcelImport(): void {
    const res = this.excelResult();
    const grpId = this.excelTargetGroupId;
    if (!res || !grpId) return;

    try {
      const summary = this.bankService.importQuestionsFromExcel(
        grpId,
        res.validRows,
        this.excelSkipDuplicates
      );

      const msg = `Successfully imported ${summary.importedCount} questions! (${summary.skippedCount} skipped, ${summary.duplicateCount} duplicates detected)`;
      this.excelSuccessSummary.set(msg);
      this.excelResult.set(null);
      // Ensure current view shows imported group
      this.selectGroup(grpId);
    } catch (err: unknown) {
      this.excelError.set(err instanceof Error ? err.message : 'Error saving questions');
    }
  }

  downloadSampleTemplate(): void {
    this.excelService.downloadTemplate();
  }

  // ── Excel Export ──────────────────────────────────────────

  exportCurrentGroupBank(): void {
    const questions = this.filteredQuestions();
    if (questions.length === 0) return;
    const groupName = this.selectedGroup()?.name || 'Group';
    this.excelService.exportQuestions(questions, `${groupName}_Question_Bank`);
  }
}
