import { useCallback, useEffect, useState } from 'react';
import type { DigestItem } from '../types';
import { getDigests, getFreshDigests } from '../data/digestSource';

// 다이제스트 로딩 상태 묶음
interface DigestState {
  items: DigestItem[];
  loading: boolean;
  error: boolean;
  capped: boolean;
  source: 'network' | 'cache' | 'static';
  lastUpdated: number | null;
  busy: boolean;
  noNew: boolean;
  freshCapped: boolean;
  reload: () => Promise<void>;
  refreshDifferent: () => Promise<void>;
}

// 관심사별 다이제스트 로딩 상태 관리 — 새로고침 재호출 제공
export function useDigests(interests: string[]): DigestState {
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [capped, setCapped] = useState(false);
  const [source, setSource] = useState<DigestState['source']>('network');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); // 다른 뉴스 조회 진행 중
  const [noNew, setNoNew] = useState(false); // 더 새로운 뉴스 없음 안내
  const [freshCapped, setFreshCapped] = useState(false); // 다른 뉴스 일일 한도 도달

  const key = interests.join(','); // 배열 식별자 안정화(변경 감지용)

  // 현재 관심사로 다이제스트 재조회
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getDigests(key ? key.split(',') : []);
      setItems(result.items);
      setCapped(result.capped);
      setSource(result.source);
      // 네트워크 신규 조회만 갱신 시각 표기(캐시·정적은 신선도 오해 방지 위해 생략)
      setLastUpdated(result.source === 'network' ? Date.now() : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [key]);

  // 다른 뉴스 조회 — 결과 있으면 교체, 없으면 기존 유지 + 안내
  const refreshDifferent = useCallback(async () => {
    setBusy(true);
    setNoNew(false);
    setFreshCapped(false);
    try {
      const result = await getFreshDigests(key ? key.split(',') : []);
      if (result.items.length > 0) {
        setItems(result.items);
        setSource('network');
        setLastUpdated(Date.now());
      } else if (result.capped) {
        setFreshCapped(true); // 한도 도달 — '뉴스 없음'과 구분 안내
      } else {
        setNoNew(true);
      }
    } catch {
      setNoNew(true);
    } finally {
      setBusy(false);
    }
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    items,
    loading,
    error,
    capped,
    source,
    lastUpdated,
    busy,
    noNew,
    freshCapped,
    reload,
    refreshDifferent,
  };
}
