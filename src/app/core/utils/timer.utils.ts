/**
 * Format total seconds into MM:SS display string.
 */
export function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse minutes and seconds into total seconds.
 */
export function toTotalSeconds(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

/**
 * Extract minutes and seconds from total seconds.
 */
export function fromTotalSeconds(totalSeconds: number): { minutes: number; seconds: number } {
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}
