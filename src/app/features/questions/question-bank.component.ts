import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ClassService } from '../../core/services/class.service';
import { QuestionService } from '../../core/services/question.service';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { ExcelService } from '../../core/services/excel.service';
import { I18nService } from '../../core/services/i18n.service';
import { PenaltyMode, Question, QuestionOption, QuestionType } from '../../core/models/question.model';
import { BankQuestion, QuestionGroup } from '../../core/models/question-bank.model';
import { formatTimer, fromTotalSeconds, toTotalSeconds } from '../../core/utils';
import { NavbarComponent, NavAction } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-question-bank',
  imports: [FormsModule, NavbarComponent],
  templateUrl: './question-bank.component.html',
})
export class QuestionBankComponent implements OnInit {
  classId = input.required<string>();

  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private classService = inject(ClassService);
  private questionService = inject(QuestionService);
  private bankService = inject(QuestionBankService);
  private excelService = inject(ExcelService);
  private confirmationService = inject(ConfirmationService);

  readonly navActions = computed<NavAction[]>(() => {
    const list: NavAction[] = [];
    if (this.questions().length > 0) {
      list.push({
        label: this.i18n.t('bank.exportExcelBtn'),
        icon: 'pi pi-download',
        callback: () => this.exportQuestionsToExcel(),
        style: 'ghost',
      });
    }
    list.push(
      {
        label: this.i18n.t('bank.importFromBankBtn'),
        icon: 'pi pi-database',
        callback: () => this.openImportModal(),
        style: 'secondary',
      },
      {
        label: this.i18n.t('questions.createQuestion'),
        icon: 'pi pi-plus',
        callback: () => this.openCreateModal(),
        style: 'primary',
        hideOnMobile: false,
      }
    );
    return list;
  });

  readonly currentClass = computed(() => {
    return this.classService.classes().find(c => c.id === this.classId()) ?? null;
  });

  readonly questions = this.questionService.questions;
  readonly groups = this.bankService.groups;

  readonly showModal = signal(false);
  readonly editingQuestionId = signal<string | null>(null);
  readonly formError = signal('');

  // ── Import from Bank Modal State ──────────────────────────
  readonly showImportModal = signal(false);
  readonly importTargetGroupId = signal<string>('');
  readonly importSearchQuery = signal<string>('');
  readonly importCategoryFilter = signal<string | null>(null);
  readonly selectedBankQuestionIds = signal<Set<string>>(new Set());
  readonly importSuccessMessage = signal<string | null>(null);

  readonly availableBankQuestions = computed(() => {
    const grpId = this.importTargetGroupId();
    if (!grpId) return [];
    let list = this.bankService.bankQuestions().filter(q => q.groupId === grpId);

    const cat = this.importCategoryFilter();
    if (cat) {
      list = list.filter(q => (q.category || 'General').toLowerCase() === cat.toLowerCase());
    }

    const query = this.importSearchQuery().trim().toLowerCase();
    if (query) {
      list = list.filter(q =>
        q.text.toLowerCase().includes(query) ||
        (q.category || '').toLowerCase().includes(query) ||
        (q.correctAnswer || '').toLowerCase().includes(query)
      );
    }
    return list;
  });

  readonly importCategories = computed(() => {
    const grpId = this.importTargetGroupId();
    if (!grpId) return [];
    const set = new Set<string>();
    this.bankService.bankQuestions()
      .filter(q => q.groupId === grpId)
      .forEach(q => {
        if (q.category) set.add(q.category.trim());
      });
    return Array.from(set).sort();
  });

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
    this.questionService.loadQuestions(this.classId());
  }

  goBack(): void {
    this.router.navigate(['/classes', this.classId()]);
  }

  formatTime(seconds: number): string {
    return formatTimer(seconds);
  }

  openCreateModal(): void {
    this.editingQuestionId.set(null);
    this.formError.set('');
    this.formQuestionType = 'mcq';
    this.formCategory = 'General';
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
    this.showModal.set(true);
  }

  openEditModal(q: Question): void {
    this.editingQuestionId.set(q.id);
    this.formError.set('');
    this.formQuestionType = q.questionType || 'mcq';
    this.formCategory = q.category || 'General';
    this.formText = q.text;
    this.formOptions = q.options.length > 0 ? q.options.map(o => ({ ...o })) : [{ text: '' }, { text: '' }];
    this.formCorrectIndex = q.correctOptionIndex >= 0 ? q.correctOptionIndex : 0;
    this.formCorrectAnswer = q.correctAnswer || '';
    this.formAcceptedAnswersText = (q.acceptedAnswers || []).join(', ');
    this.formPoints = q.points;
    const split = fromTotalSeconds(q.timerSeconds);
    this.formTimerMinutes = split.minutes;
    this.formTimerSeconds = split.seconds;
    this.formPenaltyMode = q.penaltyMode;
    this.formGreenCardReward = q.isGreenCardReward ?? false;
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.formError.set('');
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
    this.formError.set('');
    const text = this.formText.trim();
    if (!text) {
      this.formError.set('Please provide question text');
      return;
    }

    const qType = this.formQuestionType;
    let filledOptions: QuestionOption[] = [];

    if (qType === 'mcq') {
      filledOptions = this.formOptions.filter(o => o.text.trim().length > 0);
      if (filledOptions.length < 2) {
        this.formError.set('Please provide at least 2 non-empty options');
        return;
      }
      if (this.formCorrectIndex < 0 || this.formCorrectIndex >= filledOptions.length) {
        this.formError.set('Please select which option is the correct answer');
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
        this.formError.set('Please provide the correct answer');
        return;
      }
    }

    const totalSeconds = toTotalSeconds(this.formTimerMinutes || 0, this.formTimerSeconds || 0);
    if (totalSeconds <= 0) {
      this.formError.set('Timer duration must be greater than 0 seconds');
      return;
    }

    if (!this.formPoints || this.formPoints <= 0) {
      this.formError.set('Points must be greater than 0');
      return;
    }

    const acceptedList = this.formAcceptedAnswersText
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    try {
      const editId = this.editingQuestionId();
      if (editId) {
        this.questionService.updateQuestion({
          id: editId,
          classId: this.classId(),
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
        this.questionService.createQuestion({
          classId: this.classId(),
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
      this.closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving question';
      this.formError.set(msg);
    }
  }

  confirmDeleteQuestion(id: string): void {
    this.confirmationService.confirm({
      header: this.i18n.t('questions.deleteQuestionTitle'),
      message: this.i18n.t('questions.deleteQuestionMessage'),
      icon: 'pi pi-exclamation-triangle text-red-500 text-xl',
      acceptLabel: this.i18n.t('common.delete'),
      rejectLabel: this.i18n.t('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        this.questionService.deleteQuestion(id, this.classId());
      },
    });
  }

  seedSampleQuestions(): void {
    const isAr = this.i18n.lang() === 'ar';
    const samples = isAr
      ? [
          {
            questionType: 'mcq' as QuestionType,
            text: 'ما هو أقرب كوكب إلى الشمس في مجموعتنا الشمسية؟',
            options: [{ text: 'الزهرة' }, { text: 'عطارد' }, { text: 'المريخ' }, { text: 'الأرض' }],
            correctOptionIndex: 1,
            points: 20,
            timerSeconds: 30,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'true_false' as QuestionType,
            text: 'سور الصين العظيم يمكن رؤيته بالعين المجردة من الفضاء الخارجي.',
            options: [{ text: 'صح' }, { text: 'خطأ' }],
            correctOptionIndex: 1,
            points: 15,
            timerSeconds: 30,
            penaltyMode: 'deduct' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'short_answer' as QuestionType,
            text: 'ما هي عاصمة دولة فرنسا؟',
            options: [],
            correctOptionIndex: -1,
            correctAnswer: 'باريس',
            acceptedAnswers: ['باريس'],
            points: 25,
            timerSeconds: 45,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'complete' as QuestionType,
            text: 'البناء الضوئي هو العملية التي تحول بها النباتات الطاقة الضوئية إلى طاقة _____.',
            options: [],
            correctOptionIndex: -1,
            correctAnswer: 'كيميائية',
            acceptedAnswers: ['كيميائية'],
            points: 30,
            timerSeconds: 60,
            penaltyMode: 'deduct' as PenaltyMode,
            isGreenCardReward: true,
          },
          {
            questionType: 'mcq' as QuestionType,
            text: 'ما هو الغاز الذي تمتصه النباتات أثناء عملية البناء الضوئي؟',
            options: [{ text: 'الأكسجين' }, { text: 'ثاني أكسيد الكربون' }, { text: 'النيتروجين' }, { text: 'الهيدروجين' }],
            correctOptionIndex: 1,
            points: 20,
            timerSeconds: 45,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
        ]
      : [
          {
            questionType: 'mcq' as QuestionType,
            text: 'What is the closest planet to the Sun?',
            options: [{ text: 'Venus' }, { text: 'Mercury' }, { text: 'Mars' }, { text: 'Earth' }],
            correctOptionIndex: 1,
            points: 20,
            timerSeconds: 30,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'true_false' as QuestionType,
            text: 'The Great Wall of China is visible from space with the naked eye.',
            options: [{ text: 'True' }, { text: 'False' }],
            correctOptionIndex: 1,
            points: 15,
            timerSeconds: 30,
            penaltyMode: 'deduct' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'short_answer' as QuestionType,
            text: 'What is the capital city of France?',
            options: [],
            correctOptionIndex: -1,
            correctAnswer: 'Paris',
            acceptedAnswers: ['Paris', 'paris'],
            points: 25,
            timerSeconds: 45,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
          {
            questionType: 'complete' as QuestionType,
            text: 'Photosynthesis is the process by which plants convert light energy into _____ energy.',
            options: [],
            correctOptionIndex: -1,
            correctAnswer: 'chemical',
            acceptedAnswers: ['chemical', 'Chemical'],
            points: 30,
            timerSeconds: 60,
            penaltyMode: 'deduct' as PenaltyMode,
            isGreenCardReward: true,
          },
          {
            questionType: 'mcq' as QuestionType,
            text: 'Which gas do plants absorb from the atmosphere for photosynthesis?',
            options: [{ text: 'Oxygen' }, { text: 'Carbon Dioxide' }, { text: 'Nitrogen' }, { text: 'Hydrogen' }],
            correctOptionIndex: 1,
            points: 20,
            timerSeconds: 45,
            penaltyMode: 'none' as PenaltyMode,
            isGreenCardReward: false,
          },
        ];

    for (const s of samples) {
      this.questionService.createQuestion({
        classId: this.classId(),
        ...s,
      });
    }
  }

  // ── Import from Central Bank ──────────────────────────────

  isAlreadyImported(bq: BankQuestion): boolean {
    const text = bq.text.trim().toLowerCase();
    return this.questions().some(
      q => q.sourceBankQuestionId === bq.id || q.text.trim().toLowerCase() === text
    );
  }

  openImportModal(): void {
    this.importSuccessMessage.set(null);
    this.selectedBankQuestionIds.set(new Set());
    this.importCategoryFilter.set(null);
    this.importSearchQuery.set('');

    const cls = this.currentClass();
    const grps = this.groups();
    const targetId = cls?.groupId || (grps.length > 0 ? grps[0].id : '');
    this.importTargetGroupId.set(targetId);
    if (targetId) {
      this.bankService.loadBankQuestions(targetId);
    }
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
    this.selectedBankQuestionIds.set(new Set());
    this.importSuccessMessage.set(null);
  }

  onImportGroupChange(groupId: string): void {
    this.importTargetGroupId.set(groupId);
    this.selectedBankQuestionIds.set(new Set());
    this.importCategoryFilter.set(null);
    this.bankService.loadBankQuestions(groupId);
  }

  toggleSelectBankQuestion(id: string): void {
    const set = new Set(this.selectedBankQuestionIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedBankQuestionIds.set(set);
  }

  toggleSelectAllBankQuestions(): void {
    const importable = this.availableBankQuestions().filter(q => !this.isAlreadyImported(q));
    const current = this.selectedBankQuestionIds();
    if (current.size === importable.length && importable.length > 0) {
      this.selectedBankQuestionIds.set(new Set());
    } else {
      this.selectedBankQuestionIds.set(new Set(importable.map(q => q.id)));
    }
  }

  executeImport(): void {
    const ids = this.selectedBankQuestionIds();
    if (ids.size === 0) return;

    const bankList = this.availableBankQuestions().filter(q => ids.has(q.id));
    const importedCount = this.questionService.importQuestionsFromBank(this.classId(), bankList);

    this.importSuccessMessage.set(
      `Successfully imported ${importedCount} questions from ${this.getGroupName(this.importTargetGroupId())}!`
    );
    this.selectedBankQuestionIds.set(new Set());
    setTimeout(() => {
      this.closeImportModal();
    }, 1200);
  }

  getGroupName(groupId: string): string {
    return this.groups().find(g => g.id === groupId)?.name || 'Group';
  }

  // ── Classroom Excel Export ────────────────────────────────

  exportQuestionsToExcel(): void {
    const questions = this.questions();
    if (questions.length === 0) return;
    const title = (this.currentClass()?.name || 'Classroom') + '_Questions';
    this.excelService.exportQuestions(questions, title);
  }

  downloadSampleTemplate(): void {
    this.excelService.downloadTemplate();
  }
}
