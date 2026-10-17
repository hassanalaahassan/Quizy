import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { BankQuestion } from '../models/question-bank.model';
import { Question, QuestionOption, QuestionType } from '../models/question.model';

export interface ParsedRowResult {
  index: number;
  text: string;
  answer: string;
  category: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctOptionIndex: number;
  correctAnswer: string;
  points: number;
  timerSeconds: number;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
}

export interface ExcelParseResult {
  fileName: string;
  totalRows: number;
  validRows: ParsedRowResult[];
  invalidRows: ParsedRowResult[];
  detectedColumns: {
    questionCol: string;
    answerCol: string;
    categoryCol?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ExcelService {
  /**
   * Parse an uploaded Excel file (.xlsx, .xls) and return structured preview rows.
   */
  async parseQuestionsFile(
    file: File,
    defaultCategory: string = 'General',
    existingQuestionTexts: string[] = []
  ): Promise<ExcelParseResult> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in the uploaded Excel file');
    }

    // Smart sheet detection: find the sheet containing question & answer columns
    let targetSheetName = workbook.SheetNames[0];
    let rawRows: Record<string, unknown>[] = [];
    let questionCol = '';
    let answerCol = '';
    let categoryCol: string | undefined = undefined; 
    let optionsCol = '';
    let pointsCol = '';
    let timerCol = '';

    for (const sName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        blankrows: false,
      });
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        const qCol = this.findMatchingColumn(keys, ['question', 'سؤال', 'السؤال', 'text', 'q', 'title']);
        const aCol = this.findMatchingColumn(keys, ['answer', 'إجابة', 'الإجابة', 'اجابة', 'الاجابة', 'ans', 'a', 'correct']);
        if (qCol && aCol) {
          targetSheetName = sName;
          rawRows = rows;
          questionCol = qCol;
          answerCol = aCol;
          categoryCol = this.findMatchingColumn(keys, ['category', 'تصنيف', 'التصنيف', 'قسم', 'القسم', 'cat', 'subject', 'المادة']);
          optionsCol = this.findMatchingColumn(keys, ['options', 'خيارات', 'الخيارات', 'choices']);
          pointsCol = this.findMatchingColumn(keys, ['points', 'نقاط', 'النقاط', 'score']);
          timerCol = this.findMatchingColumn(keys, ['timer', 'وقت', 'الوقت', 'seconds', 'duration']);
          break;
        }
      }
    }

    if (!questionCol || !answerCol) {
      // Fallback to first sheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', blankrows: false });
      if (rawRows.length > 0) {
        const keys = Object.keys(rawRows[0]);
        questionCol = this.findMatchingColumn(keys, ['question', 'سؤال', 'السؤال', 'text', 'q', 'title']);
        answerCol = this.findMatchingColumn(keys, ['answer', 'إجابة', 'الإجابة', 'اجابة', 'الاجابة', 'ans', 'a', 'correct']);
        categoryCol = this.findMatchingColumn(keys, ['category', 'تصنيف', 'التصنيف', 'قسم', 'القسم', 'cat', 'subject', 'المادة']);
        optionsCol = this.findMatchingColumn(keys, ['options', 'خيارات', 'الخيارات', 'choices']);
        pointsCol = this.findMatchingColumn(keys, ['points', 'نقاط', 'النقاط', 'score']);
        timerCol = this.findMatchingColumn(keys, ['timer', 'وقت', 'الوقت', 'seconds', 'duration']);
      }
    }

    if (rawRows.length === 0) {
      throw new Error('The Excel sheet contains no data rows');
    }

    if (!questionCol) {
      throw new Error('Could not find a Question column (e.g., "Question", "السؤال") in the Excel file');
    }
    if (!answerCol) {
      throw new Error('Could not find an Answer column (e.g., "Answer", "الإجابة") in the Excel file');
    }

    const normalizedExisting = new Set(existingQuestionTexts.map(t => this.normalizeText(t)));

    const validRows: ParsedRowResult[] = [];
    const invalidRows: ParsedRowResult[] = [];

    rawRows.forEach((row, idx) => {
      const rowIdx = idx + 2; // Excel 1-based, accounting for header
      const rawQ = String(row[questionCol] ?? '').trim();
      const rawA = String(row[answerCol] ?? '').trim();
      const rawCat = categoryCol ? String(row[categoryCol] ?? '').trim() : '';
      const category = rawCat || defaultCategory || 'General';

      const pointsVal = pointsCol ? Number(row[pointsCol]) : 20;
      const points = !isNaN(pointsVal) && pointsVal > 0 ? pointsVal : 20;

      const timerVal = timerCol ? Number(row[timerCol]) : 30;
      const timerSeconds = !isNaN(timerVal) && timerVal > 0 ? timerVal : 30;

      if (!rawQ) {
        invalidRows.push({
          index: rowIdx,
          text: '',
          answer: rawA,
          category,
          questionType: 'short_answer',
          options: [],
          correctOptionIndex: -1,
          correctAnswer: rawA,
          points,
          timerSeconds,
          isValid: false,
          validationError: 'Question text is empty',
        });
        return;
      }

      if (!rawA) {
        invalidRows.push({
          index: rowIdx,
          text: rawQ,
          answer: '',
          category,
          questionType: 'short_answer',
          options: [],
          correctOptionIndex: -1,
          correctAnswer: '',
          points,
          timerSeconds,
          isValid: false,
          validationError: 'Answer is empty',
        });
        return;
      }

      // Determine question type & options
      let qType: QuestionType = 'short_answer';
      let options: QuestionOption[] = [];
      let correctOptionIndex = -1;
      const rawOptions = optionsCol ? String(row[optionsCol] ?? '').trim() : '';

      const lowerAns = rawA.toLowerCase();
      const isTrueFalse = ['true', 'false', 'صح', 'خطأ', 'صواب', 'خطا'].includes(lowerAns);

      if (isTrueFalse) {
        qType = 'true_false';
        const isAr = ['صح', 'خطأ', 'صواب', 'خطا'].includes(lowerAns);
        options = isAr
          ? [{ text: 'صح' }, { text: 'خطأ' }]
          : [{ text: 'True' }, { text: 'False' }];
        correctOptionIndex = (lowerAns === 'true' || lowerAns === 'صح' || lowerAns === 'صواب') ? 0 : 1;
      } else if (rawOptions) {
        // MCQ with options separated by semicolon or comma
        const split = rawOptions.split(/[;|,]/).map(o => o.trim()).filter(Boolean);
        if (split.length >= 2) {
          qType = 'mcq';
          options = split.map(o => ({ text: o }));
          // Match answer to one of the options
          const matchedIdx = options.findIndex(o => this.normalizeText(o.text) === this.normalizeText(rawA));
          correctOptionIndex = matchedIdx >= 0 ? matchedIdx : 0;
        }
      }

      const isDup = normalizedExisting.has(this.normalizeText(rawQ));

      validRows.push({
        index: rowIdx,
        text: rawQ,
        answer: rawA,
        category,
        questionType: qType,
        options,
        correctOptionIndex,
        correctAnswer: rawA,
        points,
        timerSeconds,
        isValid: true,
        isDuplicate: isDup,
      });
    });

    return {
      fileName: file.name,
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      detectedColumns: {
        questionCol,
        answerCol,
        categoryCol,
      },
    };
  }

  /**
   * Export classroom or bank questions to a downloadable Excel file.
   */
  exportQuestions(questions: (Question | BankQuestion)[], fileTitle: string = 'Questions'): void {
    if (questions.length === 0) {
      throw new Error('No questions to export');
    }

    const rows = questions.map((q, idx) => {
      let answerText = '';
      let optionsText = '';

      if (q.questionType === 'mcq' || (!q.questionType && q.options?.length > 0)) {
        optionsText = q.options.map(o => o.text).join('; ');
        answerText = q.correctOptionIndex >= 0 && q.options[q.correctOptionIndex]
          ? q.options[q.correctOptionIndex].text
          : '';
      } else if (q.questionType === 'true_false') {
        answerText = q.correctOptionIndex === 0 ? 'True' : 'False';
        optionsText = 'True; False';
      } else {
        answerText = q.correctAnswer || (q.acceptedAnswers && q.acceptedAnswers[0]) || '';
      }

      return {
        '#': idx + 1,
        'Question': q.text,
        'Answer': answerText,
        'Category': (q as BankQuestion).category || q.category || 'General',
        'Question Type': q.questionType || 'mcq',
        'Options': optionsText,
        'Points': q.points,
        'Timer (Seconds)': q.timerSeconds,
        'Penalty Mode': q.penaltyMode,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths
    const colWidths = [
      { wch: 4 },  // #
      { wch: 40 }, // Question
      { wch: 25 }, // Answer
      { wch: 18 }, // Category
      { wch: 16 }, // Type
      { wch: 30 }, // Options
      { wch: 10 }, // Points
      { wch: 16 }, // Timer
      { wch: 14 }, // Penalty
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    const sanitizedTitle = fileTitle.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_');
    XLSX.writeFile(workbook, `${sanitizedTitle}.xlsx`);
  }

  /**
   * Helper to download a comprehensive Excel template file for teachers.
   * Contains two sheets:
   * 1. 'الأسئلة (Questions)': Ready-to-fill table with Arabic and English examples.
   * 2. 'تعليمات الاستخدام (Guide)': Comprehensive guidelines for every column.
   */
  downloadTemplate(): void {
    const templateRows = [
      {
        'Question': 'ما هي عاصمة جمهورية مصر العربية؟',
        'Answer': 'القاهرة',
        'Category': 'جغرافيا',
        'Options': '',
        'Points': 20,
        'Timer (Seconds)': 30,
      },
      {
        'Question': 'ما هو أقرب كوكب إلى الشمس في المجموعة الشمسية؟',
        'Answer': 'عطارد',
        'Category': 'علوم وفلك',
        'Options': 'الزهرة; عطارد; المريخ; الأرض',
        'Points': 20,
        'Timer (Seconds)': 30,
      },
      {
        'Question': 'تدور الأرض حول الشمس مرة كل 365 يوماً تقريباً.',
        'Answer': 'صح',
        'Category': 'علوم',
        'Options': 'صح; خطأ',
        'Points': 15,
        'Timer (Seconds)': 25,
      },
      {
        'Question': 'What is the powerhouse of the cell?',
        'Answer': 'Mitochondria',
        'Category': 'Biology',
        'Options': 'Nucleus; Mitochondria; Ribosome; Chloroplast',
        'Points': 20,
        'Timer (Seconds)': 30,
      },
      {
        'Question': 'What does CPU stand for in computer science?',
        'Answer': 'Central Processing Unit',
        'Category': 'Hardware',
        'Options': '',
        'Points': 25,
        'Timer (Seconds)': 40,
      },
      {
        'Question': 'Light travels faster than sound in a vacuum.',
        'Answer': 'True',
        'Category': 'Physics',
        'Options': 'True; False',
        'Points': 15,
        'Timer (Seconds)': 25,
      },
    ];

    const questionsSheet = XLSX.utils.json_to_sheet(templateRows);
    questionsSheet['!cols'] = [
      { wch: 48 }, // Question
      { wch: 26 }, // Answer
      { wch: 20 }, // Category
      { wch: 42 }, // Options
      { wch: 12 }, // Points
      { wch: 18 }, // Timer
    ];

    // Sheet 2: Guide & Instructions
    const guideRows = [
      {
        'العمود (Column)': 'Question / السؤال',
        'الحالة (Status)': 'مطلوب (Required)',
        'الشرح والتفاصيل (Description)': 'نص السؤال المراد عرضه على الشاشة أمام الطلاب في الفصل.',
        'أمثلة (Examples)': 'ما هي عاصمة مصر؟ / What is CPU?',
      },
      {
        'العمود (Column)': 'Answer / الإجابة',
        'الحالة (Status)': 'مطلوب (Required)',
        'الشرح والتفاصيل (Description)': 'الإجابة الصحيحة. إذا كان السؤال اختياراً من متعدد، اكتب نفس نص الخيار الصحيح. للصح والخطأ، اكتب "صح" أو "خطأ" أو "True" أو "False".',
        'أمثلة (Examples)': 'القاهرة / عطارد / صح / Mitochondria / True',
      },
      {
        'العمود (Column)': 'Category / التصنيف',
        'الحالة (Status)': 'اختياري (Optional)',
        'الشرح والتفاصيل (Description)': 'المادة أو التصنيف (لتنظيم الأسئلة والفلترة). القيمة الافتراضية: General.',
        'أمثلة (Examples)': 'علوم / جغرافيا / تكنولوجيا / Biology',
      },
      {
        'العمود (Column)': 'Options / الخيارات',
        'الحالة (Status)': 'اختياري (Optional)',
        'الشرح والتفاصيل (Description)': 'خاص بأسئلة الاختيار من متعدد (MCQ) فقط. افصل بين الخيارات بفاصلة منقوطة (;). إذا تركته فارغاً سيصبح سؤال إجابة نصية حرة.',
        'أمثلة (Examples)': 'الزهرة; عطارد; المريخ; الأرض',
      },
      {
        'العمود (Column)': 'Points / النقاط',
        'الحالة (Status)': 'اختياري (Optional)',
        'الشرح والتفاصيل (Description)': 'النقاط الممنوحة للفريق عند الإجابة الصحيحة. القيمة الافتراضية: 20 نقطة.',
        'أمثلة (Examples)': '10 / 20 / 30 / 50',
      },
      {
        'العمود (Column)': 'Timer (Seconds) / الوقت',
        'الحالة (Status)': 'اختياري (Optional)',
        'الشرح والتفاصيل (Description)': 'مدة العداد التنازلي للسؤال بالثواني. القيمة الافتراضية: 30 ثانية.',
        'أمثلة (Examples)': '20 / 30 / 45 / 60',
      },
    ];

    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    guideSheet['!cols'] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 60 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'الأسئلة (Questions)');
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'تعليمات الاستخدام (Guide)');

    XLSX.writeFile(workbook, 'Quiziyyy_Questions_Template.xlsx');
  }

  private findMatchingColumn(keys: string[], aliases: string[]): string {
    for (const key of keys) {
      const cleanKey = key.trim().toLowerCase();
      for (const alias of aliases) {
        if (cleanKey === alias || cleanKey.includes(alias)) {
          return key;
        }
      }
    }
    return '';
  }

  private normalizeText(text: string): string {
    return text.trim().toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, '').replace(/\s+/g, ' ');
  }
}
