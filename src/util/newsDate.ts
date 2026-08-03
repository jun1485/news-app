import type { DigestItem } from '../types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// 목록 노출 대상 기간(오늘 포함 일수)
const RECENT_DAYS = 1;

// 한국 기준 날짜 추출
function kstDate(offsetMs = 0): string {
  return new Date(Date.now() + KST_OFFSET_MS - offsetMs).toISOString().slice(0, 10);
}

// 한국 기준 오늘 날짜 추출
export function todayInKst(): string {
  return kstDate();
}

// 노출 하한 게시일 추출
export function recentCutoffDate(): string {
  return kstDate((RECENT_DAYS - 1) * DAY_MS);
}

// 최근 게시된 기사만 선별
export function onlyRecentlyPublished(items: DigestItem[]): DigestItem[] {
  const cutoff = recentCutoffDate();
  return items.filter((item) => item.publishedAt != null && item.publishedAt >= cutoff);
}
