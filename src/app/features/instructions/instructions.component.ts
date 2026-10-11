import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher.component';

@Component({
  selector: 'app-instructions',
  imports: [LanguageSwitcherComponent],
  templateUrl: './instructions.component.html',
})
export class InstructionsComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);

  readonly localizedInstructions = computed(() => {
    const isAr = this.i18n.lang() === 'ar';
    return isAr
      ? [
          {
            icon: 'pi pi-users',
            title: 'تشكيل الفرق الطلابية',
            description: 'يتم تقسيم طلاب الفصل إلى فرق تضم نحو 4–5 طلاب، مع تعيين قائد لكل فريق لتنسيق النقاش وتنظيم الأدوار.',
          },
          {
            icon: 'pi pi-comments',
            title: 'التشاور والإجابة الشفهية',
            description: 'عند ظهور السؤال على الشاشة، يتشاور أفراد الفريق معاً. ثم يتقدم طالب واحد إلى مقدمة الفصل ليجيب شفهياً.',
          },
          {
            icon: 'pi pi-check-circle',
            title: 'احتساب الدرجات والعقوبات',
            description: 'يحدد المعلم إجابة الطالب بنقرة واحدة. الإجابات الصحيحة تمنح نقاطاً، بينما يمكن للإجابات الخاطئة أن تخصم نقاطاً حسب إعدادات السؤال.',
          },
          {
            icon: 'pi pi-clock',
            title: 'المؤقت الزمني لكل سؤال',
            description: 'لكل سؤال مؤقته التنازلي الخاص. يناقش الطلاب ويجيبون قبل نفاد الوقت مع إمكانية تحكم المعلم الكامل بالمؤقت.',
          },
          {
            icon: 'pi pi-bolt',
            title: 'بطاقات القوة التكتيكية',
            description: 'تكسب الفرق بطاقات قوة عند تجميع النقاط، مثل بطاقة مضاعفة النقاط (2X) ودرع الحماية لمنع خصم النقاط عند الخطأ.',
          },
          {
            icon: 'pi pi-desktop',
            title: 'تحكم المعلم وحفظ الجلسات',
            description: 'يتحكم المعلم بجميع مجريات اللعبة من جهازه المحمول، ويتم حفظ كافة الدرجات والجلسات لاستئنافها في أي وقت.',
          },
        ]
      : [
          {
            icon: 'pi pi-users',
            title: 'Teams & Leaders',
            description: 'Students are divided into teams of 4–5. Each team has a leader who helps coordinate discussions.',
          },
          {
            icon: 'pi pi-comments',
            title: 'Discussion & Verbal Answering',
            description: 'When a question appears, teams discuss together. Then one student goes to the front and answers verbally.',
          },
          {
            icon: 'pi pi-check-circle',
            title: 'Scoring & Penalties',
            description: 'The teacher selects the answer given by the student. Correct answers earn points. Wrong answers may either have no penalty or deduct points, depending on the question.',
          },
          {
            icon: 'pi pi-clock',
            title: 'Per-Question Timer',
            description: 'Each question has its own timer. Teams must discuss and answer before time runs out. The teacher controls the timer.',
          },
          {
            icon: 'pi pi-bolt',
            title: 'Strategic Power Cards',
            description: 'Teams can earn special Power Cards as they score points. Use them strategically to gain advantages like doubling points or shielding against penalties.',
          },
          {
            icon: 'pi pi-desktop',
            title: 'Teacher Controls & Session Resume',
            description: 'The teacher controls everything from the laptop. Sessions can be paused and resumed days later without losing a single point or question progress.',
          },
        ];
  });

  goBack(): void {
    this.router.navigate(['/']);
  }
}
