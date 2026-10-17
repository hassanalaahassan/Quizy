const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

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

if (!fs.existsSync('docs')) fs.mkdirSync('docs', { recursive: true });
if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });

XLSX.writeFile(workbook, path.join('public', 'Quiziyyy_Questions_Template.xlsx'));
XLSX.writeFile(workbook, path.join('docs', 'Quiziyyy_Questions_Template.xlsx'));

console.log('Successfully created Quiziyyy_Questions_Template.xlsx in public/ and docs/');
