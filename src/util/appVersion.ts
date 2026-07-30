import Constants from 'expo-constants';
import { APP_VERSION_URL, STORE_URL } from '../config';

const FETCH_TIMEOUT_MS = 6000;

// 배포 버전 정보 응답 — 필드 누락 가능
interface AppVersionRaw {
  latestVersion?: string;
  storeUrl?: string;
  highlights?: string[];
}

// 배포 버전 정보
export interface AppVersionInfo {
  latestVersion: string;
  storeUrl: string;
  highlights: string[];
}

// 실행 중인 앱 버전 추출
export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

// 버전 문자열 숫자 단위 분해
function parseVersion(version: string): number[] {
  return version
    .trim()
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

// 버전 문자열 형식 유효성 판정
function isValidVersion(version: string): boolean {
  return /^\d+(\.\d+)*$/.test(version.trim());
}

// 배포 버전이 실행 버전보다 높은지 판정
export function isNewerVersion(latest: string, current: string): boolean {
  if (!isValidVersion(latest) || !isValidVersion(current)) return false;
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

// 배포 버전 정보 조회 — 응답 불량 시 null
export async function fetchAppVersion(): Promise<AppVersionInfo | null> {
  if (!APP_VERSION_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${APP_VERSION_URL}?t=${Date.now()}`, { signal: controller.signal });
    if (!res.ok) return null;
    const raw: AppVersionRaw = await res.json();
    const latestVersion = raw.latestVersion?.trim();
    if (!latestVersion || !isValidVersion(latestVersion)) return null;
    return {
      latestVersion,
      storeUrl: raw.storeUrl?.trim() || STORE_URL,
      highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
