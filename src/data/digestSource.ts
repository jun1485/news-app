import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DigestItem } from '../types';
import { WORKER_URL } from '../config';
import { getDeviceId } from '../storage/deviceId';
import { PRESET_CATEGORIES } from './interests';
import { SAMPLE_DIGESTS } from './sampleDigests';
import { GENERATED_DIGESTS } from './generatedDigests';

const PRESETS: readonly string[] = PRESET_CATEGORIES;
const CACHE_PREFIX = 'digest_cache_v1:';

// Worker 응답 형태
interface DigestResponse {
  items: DigestItem[];
  cached: boolean;
  capped?: boolean;
}

// 조회 결과 — 데이터 출처·일일 한도 도달 여부 포함
export interface DigestFetchResult {
  items: DigestItem[];
  source: 'network' | 'cache' | 'static';
  capped: boolean;
}

// 다른 뉴스 조회 — 관심사별 fresh 재생성, 네트워크 결과만 반환(정적 폴백 없음 → 0건이면 호출측이 기존 유지)
export async function getFreshDigests(interests: string[]): Promise<DigestFetchResult> {
  if (interests.length === 0 || !WORKER_URL) return { items: [], source: 'network', capped: false };
  const deviceId = await getDeviceId().catch(() => 'anon');
  let anyCapped = false;
  const perInterest = await Promise.all(
    interests.map(async (interest) => {
      try {
        const res = await fetchInterest(interest, deviceId, true);
        if (res.capped) anyCapped = true;
        return res.items;
      } catch {
        return [];
      }
    }),
  );
  return { items: dedupe(perInterest.flat()), source: 'network', capped: anyCapped };
}

// 관심사별 다이제스트 조회 — 관심사 단위 Worker 조회, 0건/실패는 해당 관심사만 정적 대체
export async function getDigests(interests: string[]): Promise<DigestFetchResult> {
  if (interests.length === 0) return { items: [], source: 'static', capped: false };

  // Worker 미설정 시 정적 데이터로 동작(백엔드 미연결 호환)
  if (!WORKER_URL) return { items: filterStatic(interests), source: 'static', capped: false };

  const deviceId = await getDeviceId().catch(() => 'anon');
  let anyNetwork = false;
  let anyCapped = false;

  // 관심사 하나가 비거나 실패해도 나머지·정적 결과로 채움
  const perInterest = await Promise.all(
    interests.map(async (interest) => {
      try {
        const res = await fetchInterest(interest, deviceId);
        if (res.capped) anyCapped = true;
        if (res.items.length > 0) {
          anyNetwork = true;
          return res.items;
        }
        return filterStatic([interest]); // Worker 0건 → 정적 대체
      } catch {
        return filterStatic([interest]); // 네트워크 실패 → 정적 대체
      }
    }),
  );

  const items = dedupe(perInterest.flat());
  if (anyNetwork) {
    await saveCache(interests, items);
    return { items, source: 'network', capped: anyCapped };
  }
  // 네트워크 0건 — 직전 캐시 우선, 없으면 정적 대체본
  const cached = await loadCache(interests);
  if (cached && cached.length > 0) return { items: cached, source: 'cache', capped: anyCapped };
  return { items, source: 'static', capped: anyCapped };
}

// 관심사 1건 조회 — 프리셋이면 카테고리, 아니면 키워드 엔드포인트(fresh=다른 뉴스)
async function fetchInterest(interest: string, deviceId: string, fresh = false): Promise<DigestResponse> {
  const param = PRESETS.includes(interest)
    ? `category=${encodeURIComponent(interest)}`
    : `kw=${encodeURIComponent(interest)}`;
  const url = `${WORKER_URL}/digest?${param}${fresh ? '&fresh=1' : ''}`;
  const res = await fetch(url, { headers: { 'x-device-id': deviceId } });
  if (!res.ok) throw new Error(`digest fetch failed: ${res.status}`);
  return (await res.json()) as DigestResponse;
}

// 매체명+헤드라인 기준 중복 제거 — 정적본의 매체 홈 URL 공유로 인한 과도 축소 방지
function dedupe(items: DigestItem[]): DigestItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = `${item.sourceName}|${item.headline}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// 정적 데이터 관심사 필터(폴백) — 카테고리 일치 또는 키워드 부분일치
function filterStatic(interests: string[]): DigestItem[] {
  const source = GENERATED_DIGESTS.length > 0 ? GENERATED_DIGESTS : SAMPLE_DIGESTS;
  return source.filter((item) => {
    const haystack = `${item.category} ${item.headline} ${item.summary}`.toLowerCase();
    return interests.some((i) => item.category === i || haystack.includes(i.toLowerCase()));
  });
}

// 관심사 집합 캐시 키
function cacheKey(interests: string[]): string {
  return CACHE_PREFIX + [...interests].sort().join('|');
}

// 조회 결과 오프라인 캐시 저장
async function saveCache(interests: string[], items: DigestItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(interests), JSON.stringify(items));
  } catch {
    // 캐시 저장 실패는 무시
  }
}

// 캐시된 조회 결과 로드
async function loadCache(interests: string[]): Promise<DigestItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(interests));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DigestItem[]) : null;
  } catch {
    return null;
  }
}
