import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DigestItem } from "../types";
import { WORKER_URL } from "../config";
import { getDeviceId } from "../storage/deviceId";
import { PRESET_CATEGORIES } from "./interests";
import { SAMPLE_DIGESTS } from "./sampleDigests";
import { GENERATED_DIGESTS } from "./generatedDigests";
import { isValidArticleUrl } from "../util/urlCheck";

const PRESETS: readonly string[] = PRESET_CATEGORIES;
const CACHE_PREFIX = "digest_cache_v2:";

// Worker 응답 형태
interface DigestResponse {
  items: DigestItem[];
  cached: boolean;
  generatedAt: string;
  capped?: boolean;
  stale?: boolean;
}

// 오프라인 캐시 단위
interface DigestCacheEntry {
  items: DigestItem[];
  generatedAt: string | null;
}

export type DigestSource =
  | "network"
  | "cache"
  | "static"
  | "empty"
  | "unavailable";

// 다이제스트 조회 결과
export interface DigestFetchResult {
  items: DigestItem[];
  source: DigestSource;
  capped: boolean;
  partial: boolean;
  stale: boolean;
  generatedAt: string | null;
}

// 다른 뉴스 조회 결과 제공
export async function getFreshDigests(
  interests: string[],
): Promise<DigestFetchResult> {
  if (interests.length === 0)
    return {
      items: [],
      source: "empty",
      capped: false,
      partial: false,
      stale: false,
      generatedAt: null,
    };
  if (!WORKER_URL)
    return {
      items: [],
      source: "unavailable",
      capped: false,
      partial: false,
      stale: false,
      generatedAt: null,
    };
  const deviceId = await getDeviceId().catch(() => "anon");
  let anyCapped = false;
  let anyFailed = false;
  let anyStale = false;
  const generatedAtList: string[] = [];
  const perInterest = await Promise.all(
    interests.map(async (interest) => {
      try {
        const res = await fetchInterest(interest, deviceId, true);
        if (res.capped) anyCapped = true;
        if (res.stale) anyStale = true;
        generatedAtList.push(res.generatedAt);
        return res.items;
      } catch {
        anyFailed = true;
        return [];
      }
    }),
  );
  const items = dedupe(perInterest.flat());
  if (items.length > 0)
    return {
      items,
      source: "network",
      capped: anyCapped,
      partial: anyFailed,
      stale: anyStale,
      generatedAt: generatedAtList.sort()[0] ?? null,
    };
  if (anyFailed || anyCapped)
    return {
      items: [],
      source: "unavailable",
      capped: anyCapped,
      partial: false,
      stale: false,
      generatedAt: null,
    };
  return {
    items: [],
    source: "empty",
    capped: false,
    partial: false,
    stale: false,
    generatedAt: null,
  };
}

// 관심사별 다이제스트 조회 결과 제공
export async function getDigests(
  interests: string[],
): Promise<DigestFetchResult> {
  if (interests.length === 0)
    return {
      items: [],
      source: "empty",
      capped: false,
      partial: false,
      stale: false,
      generatedAt: null,
    };

  if (!WORKER_URL)
    return {
      items: filterStatic(interests),
      source: "static",
      capped: false,
      partial: false,
      stale: false,
      generatedAt: null,
    };

  const deviceId = await getDeviceId().catch(() => "anon");
  let anyNetwork = false;
  let anyCapped = false;
  let anyFailed = false;
  let anyStale = false;
  const generatedAtList: string[] = [];

  const perInterest = await Promise.all(
    interests.map(async (interest) => {
      try {
        const res = await fetchInterest(interest, deviceId);
        if (res.capped) anyCapped = true;
        if (res.stale) anyStale = true;
        if (res.items.length > 0) {
          anyNetwork = true;
          generatedAtList.push(res.generatedAt);
          return res.items;
        }
        return [];
      } catch {
        anyFailed = true;
        return [];
      }
    }),
  );

  const items = dedupe(perInterest.flat());
  if (anyNetwork) {
    const generatedAt = generatedAtList.sort()[0] ?? null;
    await saveCache(interests, items, generatedAt);
    return {
      items,
      source: "network",
      capped: anyCapped,
      partial: anyFailed,
      stale: anyStale,
      generatedAt,
    };
  }

  const cached = await loadCache(interests);
  if (cached && cached.items.length > 0)
    return {
      items: cached.items,
      source: "cache",
      capped: anyCapped,
      partial: false,
      stale: true,
      generatedAt: cached.generatedAt,
    };
  if (anyFailed || anyCapped)
    return {
      items: [],
      source: "unavailable",
      capped: anyCapped,
      partial: false,
      stale: false,
      generatedAt: null,
    };
  return {
    items: [],
    source: "empty",
    capped: false,
    partial: false,
    stale: false,
    generatedAt: null,
  };
}

// 관심사 1건 다이제스트 조회
async function fetchInterest(
  interest: string,
  deviceId: string,
  fresh = false,
): Promise<DigestResponse> {
  const param = PRESETS.includes(interest)
    ? `category=${encodeURIComponent(interest)}`
    : `kw=${encodeURIComponent(interest)}`;
  const url = `${WORKER_URL}/digest?${param}${fresh ? "&fresh=1" : ""}`;
  const res = await fetch(url, { headers: { "x-device-id": deviceId } });
  if (!res.ok) throw new Error(`digest fetch failed: ${res.status}`);
  const data = (await res.json()) as DigestResponse;
  return { ...data, items: withValidLinks(data.items) };
}

// 원문 링크 형식이 유효한 항목만 통과 — 잘못된 주소 카드 노출 차단
function withValidLinks(items: DigestItem[]): DigestItem[] {
  return items.filter((item) => isValidArticleUrl(item.sourceUrl));
}

// 매체명과 헤드라인 기준 중복 제거
function dedupe(items: DigestItem[]): DigestItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = `${item.sourceName}|${item.headline}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// 정적 데이터 관심사 필터
function filterStatic(interests: string[]): DigestItem[] {
  const source =
    GENERATED_DIGESTS.length > 0 ? GENERATED_DIGESTS : SAMPLE_DIGESTS;
  return withValidLinks(
    source.filter((item) => {
      const haystack =
        `${item.category} ${item.headline} ${item.summary}`.toLowerCase();
      return interests.some(
        (i) => item.category === i || haystack.includes(i.toLowerCase()),
      );
    }),
  );
}

// 관심사 집합 캐시 키
function cacheKey(interests: string[]): string {
  return CACHE_PREFIX + [...interests].sort().join("|");
}

// 조회 결과 오프라인 캐시 저장
async function saveCache(
  interests: string[],
  items: DigestItem[],
  generatedAt: string | null,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(interests),
      JSON.stringify({ items, generatedAt }),
    );
  } catch {
    // 캐시 저장 실패는 무시
  }
}

// 캐시된 조회 결과 로드
async function loadCache(
  interests: string[],
): Promise<DigestCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(interests));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DigestCacheEntry>;
    return Array.isArray(parsed.items)
      ? { items: withValidLinks(parsed.items), generatedAt: parsed.generatedAt ?? null }
      : null;
  } catch {
    return null;
  }
}
