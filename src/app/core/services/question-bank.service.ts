import { Injectable, computed, inject, signal } from '@angular/core';
import { DataSource } from '../data/data-source';
import { BankQuestion, ExcelImportSummary, QuestionGroup } from '../models/question-bank.model';
import { PenaltyMode, QuestionOption, QuestionType } from '../models/question.model';
import { generateId, now } from '../utils';
import { ParsedRowResult } from './excel.service';

export interface CreateBankQuestionDto {
  groupId: string;
  category?: string;
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
export class QuestionBankService {
  private dataSource = inject(DataSource);

  // ── State Signals ──────────────────────────────────────────
  private readonly _groups = signal<QuestionGroup[]>([]);
  private readonly _selectedGroupId = signal<string | null>(null);
  private readonly _bankQuestions = signal<BankQuestion[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _selectedCategory = signal<string | null>(null);
  private readonly _selectedType = signal<string | null>(null);

  // ── Readonly Public Signals ────────────────────────────────
  readonly groups = this._groups.asReadonly();
  readonly selectedGroupId = this._selectedGroupId.asReadonly();
  readonly bankQuestions = this._bankQuestions.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly selectedCategory = this._selectedCategory.asReadonly();
  readonly selectedType = this._selectedType.asReadonly();

  readonly selectedGroup = computed(() => {
    const id = this._selectedGroupId();
    if (!id) return null;
    return this._groups().find(g => g.id === id) ?? null;
  });

  readonly categories = computed(() => {
    const currentGroupId = this._selectedGroupId();
    const questions = currentGroupId
      ? this._bankQuestions().filter(q => q.groupId === currentGroupId)
      : this._bankQuestions();
    const catSet = new Set<string>();
    questions.forEach(q => {
      if (q.category && q.category.trim()) {
        catSet.add(q.category.trim());
      }
    });
    return Array.from(catSet).sort();
  });

  readonly filteredQuestions = computed(() => {
    const groupId = this._selectedGroupId();
    let list = this._bankQuestions();

    if (groupId) {
      list = list.filter(q => q.groupId === groupId);
    }

    const cat = this._selectedCategory();
    if (cat) {
      list = list.filter(q => q.category?.toLowerCase() === cat.toLowerCase());
    }

    const type = this._selectedType();
    if (type) {
      list = list.filter(q => (q.questionType || 'mcq') === type);
    }

    const query = this._searchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(q => {
        const textMatch = q.text.toLowerCase().includes(query);
        const ansMatch = (q.correctAnswer || '').toLowerCase().includes(query);
        const catMatch = (q.category || '').toLowerCase().includes(query);
        const optMatch = q.options?.some(o => o.text.toLowerCase().includes(query)) ?? false;
        return textMatch || ansMatch || catMatch || optMatch;
      });
    }

    return list;
  });

  constructor() {
    this.init();
  }

  private init(): void {
    this.refreshGroups();
    const grps = this._groups();
    if (grps.length > 0 && !this._selectedGroupId()) {
      this.selectGroup(grps[0].id);
    }
  }

  refreshGroups(): void {
    let grps = this.dataSource.getGroups();
    if (grps.length === 0) {
      // Auto-seed default groups
      grps = this.seedDefaultGroups();
    }
    this._groups.set(grps);
  }

  selectGroup(groupId: string | null): void {
    this._selectedGroupId.set(groupId);
    this._selectedCategory.set(null);
    if (groupId) {
      this.loadBankQuestions(groupId);
    } else {
      this.loadAllBankQuestions();
    }
  }

  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  setSelectedCategory(category: string | null): void {
    this._selectedCategory.set(category);
  }

  setSelectedType(type: string | null): void {
    this._selectedType.set(type);
  }

  // ── Group Operations ───────────────────────────────────────

  createGroup(name: string, description?: string): QuestionGroup {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Group name is required');

    const timestamp = now();
    const group: QuestionGroup = {
      id: generateId(),
      name: trimmed,
      description: description?.trim() || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.dataSource.saveGroup(group);
    this.refreshGroups();
    this.selectGroup(group.id);
    return group;
  }

  updateGroup(id: string, name: string, description?: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = this._groups().find(g => g.id === id);
    if (!existing) return;

    const updated: QuestionGroup = {
      ...existing,
      name: trimmed,
      description: description?.trim(),
      updatedAt: now(),
    };

    this.dataSource.saveGroup(updated);
    this.refreshGroups();
  }

  deleteGroup(id: string): void {
    this.dataSource.deleteGroup(id);
    this.refreshGroups();
    const remaining = this._groups();
    this.selectGroup(remaining.length > 0 ? remaining[0].id : null);
  }

  private seedDefaultGroups(): QuestionGroup[] {
    const timestamp = now();
    const defaultList: QuestionGroup[] = [
      { id: 'group_grade_1', name: 'Group 1 / Grade 1', description: 'Central bank for Grade 1 classrooms', createdAt: timestamp },
      { id: 'group_grade_2', name: 'Group 2 / Grade 2', description: 'Central bank for Grade 2 classrooms', createdAt: timestamp },
      { id: 'group_grade_3', name: 'Group 3 / Grade 3', description: 'Central bank for Grade 3 classrooms', createdAt: timestamp },
    ];
    for (const g of defaultList) {
      this.dataSource.saveGroup(g);
    }
    return defaultList;
  }

  // ── Bank Question Operations ───────────────────────────────

  loadBankQuestions(groupId: string): void {
    const list = this.dataSource.getBankQuestions(groupId);
    this._bankQuestions.set(list);
  }

  loadAllBankQuestions(): void {
    const list = this.dataSource.getBankQuestions();
    this._bankQuestions.set(list);
  }

  getExistingQuestionTexts(groupId: string): string[] {
    const list = this.dataSource.getBankQuestions(groupId);
    return list.map(q => q.text);
  }

  createBankQuestion(dto: CreateBankQuestionDto): BankQuestion {
    if (!dto.text.trim()) throw new Error('Question text is required');
    if (!dto.groupId) throw new Error('Target group is required');

    const qType = dto.questionType || 'mcq';

    if (qType === 'mcq') {
      if (dto.options.length < 2) throw new Error('At least 2 options are required');
      if (dto.correctOptionIndex < 0 || dto.correctOptionIndex >= dto.options.length) {
        throw new Error('Please select a valid correct answer');
      }
    } else if (qType === 'short_answer' || qType === 'complete') {
      if (!dto.correctAnswer?.trim()) {
        throw new Error('Please provide the correct answer');
      }
    }

    const question: BankQuestion = {
      id: generateId(),
      groupId: dto.groupId,
      category: dto.category?.trim() || 'General',
      questionType: qType,
      text: dto.text.trim(),
      options: qType === 'true_false'
        ? [{ text: 'True' }, { text: 'False' }]
        : (qType === 'mcq' ? dto.options.map(o => ({ text: o.text.trim() })) : []),
      correctOptionIndex: (qType === 'short_answer' || qType === 'complete') ? -1 : dto.correctOptionIndex,
      correctAnswer: (qType === 'short_answer' || qType === 'complete') ? dto.correctAnswer?.trim() : undefined,
      acceptedAnswers: (qType === 'short_answer' || qType === 'complete')
        ? (dto.acceptedAnswers || []).map(a => a.trim()).filter(Boolean)
        : undefined,
      points: dto.points > 0 ? dto.points : 20,
      timerSeconds: dto.timerSeconds > 0 ? dto.timerSeconds : 30,
      penaltyMode: dto.penaltyMode || 'none',
      isGreenCardReward: dto.isGreenCardReward ?? false,
      createdAt: now(),
    };

    this.dataSource.saveBankQuestion(question);
    this.loadBankQuestions(dto.groupId);
    return question;
  }

  updateBankQuestion(question: BankQuestion): void {
    const updated: BankQuestion = {
      ...question,
      updatedAt: now(),
    };
    this.dataSource.saveBankQuestion(updated);
    this.loadBankQuestions(question.groupId);
  }

  deleteBankQuestion(id: string, groupId: string): void {
    this.dataSource.deleteBankQuestion(id);
    this.loadBankQuestions(groupId);
  }

  deleteBankQuestionsBatch(ids: string[], groupId: string): void {
    for (const id of ids) {
      this.dataSource.deleteBankQuestion(id);
    }
    this.loadBankQuestions(groupId);
  }

  moveBankQuestionsBatch(ids: string[], targetGroupId: string, currentGroupId: string): void {
    const all = this.dataSource.getBankQuestions();
    const targetSet = new Set(ids);
    for (const q of all) {
      if (targetSet.has(q.id)) {
        this.dataSource.saveBankQuestion({
          ...q,
          groupId: targetGroupId,
          updatedAt: now(),
        });
      }
    }
    this.loadBankQuestions(currentGroupId);
  }

  /**
   * Import batch from Excel parsed valid rows into a target group.
   */
  importQuestionsFromExcel(
    groupId: string,
    rows: ParsedRowResult[],
    skipDuplicates: boolean = false
  ): ExcelImportSummary {
    const existingTexts = new Set(this.getExistingQuestionTexts(groupId).map(t => t.trim().toLowerCase()));
    const timestamp = now();
    const toSave: BankQuestion[] = [];
    let duplicateCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.isValid) {
        skippedCount++;
        if (row.validationError) errors.push(`Row ${row.index}: ${row.validationError}`);
        continue;
      }

      const lowerText = row.text.trim().toLowerCase();
      const isDup = existingTexts.has(lowerText);

      if (isDup) {
        duplicateCount++;
        if (skipDuplicates) {
          skippedCount++;
          continue;
        }
      }

      const bq: BankQuestion = {
        id: generateId(),
        groupId,
        category: row.category || 'General',
        questionType: row.questionType,
        text: row.text.trim(),
        options: row.options || [],
        correctOptionIndex: row.correctOptionIndex,
        correctAnswer: row.correctAnswer,
        acceptedAnswers: row.correctAnswer ? [row.correctAnswer] : undefined,
        points: row.points > 0 ? row.points : 20,
        timerSeconds: row.timerSeconds > 0 ? row.timerSeconds : 30,
        penaltyMode: 'none',
        isGreenCardReward: false,
        createdAt: timestamp,
      };

      toSave.push(bq);
      existingTexts.add(lowerText);
    }

    if (toSave.length > 0) {
      this.dataSource.saveBankQuestionsBatch(toSave);
      this.loadBankQuestions(groupId);
    }

    return {
      totalRows: rows.length,
      importedCount: toSave.length,
      skippedCount,
      duplicateCount,
      errors,
    };
  }
}
