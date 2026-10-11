import { Injectable, computed, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private timerSub: Subscription | null = null;

  private readonly _totalSeconds = signal(0);
  private readonly _remainingSeconds = signal(0);
  private readonly _isRunning = signal(false);
  private readonly _isExpired = signal(false);

  readonly totalSeconds = this._totalSeconds.asReadonly();
  readonly remainingSeconds = this._remainingSeconds.asReadonly();
  readonly isRunning = this._isRunning.asReadonly();
  readonly isExpired = this._isExpired.asReadonly();

  readonly progressPercentage = computed(() => {
    const total = this._totalSeconds();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (this._remainingSeconds() / total) * 100));
  });

  start(totalSeconds: number, initialRemaining?: number | null): void {
    this.stop();
    this._totalSeconds.set(totalSeconds);
    const startSec = initialRemaining !== null && initialRemaining !== undefined ? initialRemaining : totalSeconds;
    this._remainingSeconds.set(startSec);
    this._isExpired.set(startSec <= 0);

    if (startSec > 0) {
      this.resume();
    }
  }

  resume(): void {
    if (this._isRunning() || this._remainingSeconds() <= 0) return;

    this._isRunning.set(true);
    this.timerSub = interval(1000).subscribe(() => {
      const next = this._remainingSeconds() - 1;
      if (next <= 0) {
        this._remainingSeconds.set(0);
        this._isExpired.set(true);
        this.pause();
      } else {
        this._remainingSeconds.set(next);
      }
    });
  }

  pause(): void {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }
    this._isRunning.set(false);
  }

  toggle(): void {
    if (this._isRunning()) {
      this.pause();
    } else {
      this.resume();
    }
  }

  stop(): void {
    this.pause();
    this._remainingSeconds.set(0);
    this._isExpired.set(false);
  }

  addSeconds(seconds: number): void {
    const updated = Math.max(0, this._remainingSeconds() + seconds);
    this._remainingSeconds.set(updated);
    if (updated > 0) {
      this._isExpired.set(false);
    }
  }
}
