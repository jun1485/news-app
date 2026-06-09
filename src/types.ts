// 다이제스트 단일 뉴스 항목 — 앱 카드 1개에 대응
export interface DigestItem {
  id: string;
  category: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
}
