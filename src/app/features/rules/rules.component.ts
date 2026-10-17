import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-rules',
  imports: [NavbarComponent],
  templateUrl: './rules.component.html',
})
export class RulesComponent {
  readonly i18n = inject(I18nService);
  private router = inject(Router);

  readonly localizedRules = computed(() => { 
    const isAr = this.i18n.lang() === 'ar';
    return isAr
      ? [
          { number: 1, text: 'تتنافس الفرق الصفية ضد بعضها البعض داخل الفصل الدراسي الواحد.' },
          { number: 2, text: 'يحدد المعلم الفريق الذي سيجيب عن كل سؤال من خلال لوحة التحكم.' },
          { number: 3, text: 'يتشاور الفريق المختار معاً بهدوء قبل التقدم لتقديم الإجابة.' },
          { number: 4, text: 'يتقدم طالب واحد من الفريق المختار ويجيب شفهياً أمام الفصل والشاشة.' },
          { number: 5, text: 'يسجل المعلم الإجابة التي ذكرها الطالب باختيار الخيار من شاشته.' },
          { number: 6, text: 'الإجابات الصحيحة تزيد رصيد الفريق بمقدار نقاط السؤال المحددة.' },
          { number: 7, text: 'الإجابات الخاطئة إما لا تغير الرصيد أو تخصم نقاط السؤال حسب ضبط السؤال.' },
          { number: 8, text: 'لكل سؤال مؤقته الزمني المستقل، والمعلم يتحكم في تشغيله وإيقافه.' },
          { number: 9, text: 'تستطيع الفرق استخدام بطاقات القوة التكتيكية للتفوق وكسب ميزات إضافية.' },
          { number: 10, text: 'درجات الفرق تراكمية ومحفوظة عبر جميع الجلسات ولا تضيع عند إغلاق التطبيق.' },
        ]
      : [
          { number: 1, text: 'Teams compete against each other within the same class.' },
          { number: 2, text: 'The teacher selects which team will answer each question.' },
          { number: 3, text: 'The selected team discusses the answer together before responding.' },
          { number: 4, text: 'One student from the team answers verbally in front of the class.' },
          { number: 5, text: 'The teacher selects the answer from the available options in the app.' },
          { number: 6, text: 'Correct answers add the question\'s points to the team\'s score.' },
          { number: 7, text: 'Wrong answers either have no penalty or deduct points, depending on the question configuration.' },
          { number: 8, text: 'Each question has its own timer. The teacher controls the timer.' },
          { number: 9, text: 'Teams can earn and use Power Cards for strategic advantages.' },
          { number: 10, text: 'Team scores persist across sessions. Progress is never lost.' },
        ];
  });

  goBack(): void {
    this.router.navigate(['/']);
  }
}
