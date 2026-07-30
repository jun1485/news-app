// 원문 링크 형식 — 절대 http(s), 점 포함 도메인, 공백 없음
const ARTICLE_URL_RE = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s]*)?$/i;

// 실제 기사 주소일 수 없는 자리표시 호스트
const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'example.net', 'localhost', 'news.example.com', 'test.com', 'domain.com'];

// 원문 링크 검증 결과
export type UrlVerdict = 'ok' | 'missing' | 'unknown';

const VERIFY_TIMEOUT_MS = 4000;

// 링크 호스트 추출
function hostOf(url: string): string {
  return url.replace(/^https?:\/\//i, '').split(/[/?#:]/)[0].toLowerCase();
}

// 원문 링크 형식 유효성 판정 — 목록 적재 단계 1차 검증
export function isValidArticleUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!ARTICLE_URL_RE.test(trimmed)) return false;
  const host = hostOf(trimmed);
  return !PLACEHOLDER_HOSTS.includes(host) && !host.endsWith('.example');
}

// 원문 링크 검증 결과 및 해석된 최종 주소
export interface UrlCheckResult {
  verdict: UrlVerdict;
  url: string;
}

// 원문 링크 실제 접근 가능 여부 판정 — 열기 직전 2차 검증, 리다이렉트 해석 후 최종 주소 반환
export async function verifyArticleUrl(url: string): Promise<UrlCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    // 검색 grounding 중계 주소는 만료되므로 해석된 기사 주소를 우선 사용
    const resolved = isValidArticleUrl(res.url) ? res.url : url;
    // 삭제·이동된 기사만 차단하고, HEAD 미허용 등 나머지 상태는 통과 처리
    return { verdict: res.status === 404 || res.status === 410 ? 'missing' : 'ok', url: resolved };
  } catch {
    return { verdict: 'unknown', url };
  } finally {
    clearTimeout(timer);
  }
}

// 헤드라인 기반 뉴스 검색 주소 — 원문 링크 실패 시 대체 경로
export function newsSearchUrl(headline: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(headline)}`;
}
