import { useCallback, useEffect, useState } from "react";
import type { DigestItem } from "../types";
import { getDigests, getFreshDigests } from "../data/digestSource";
import type { DigestSource } from "../data/digestSource";

// 다이제스트 화면 상태
interface DigestState {
  items: DigestItem[];
  loading: boolean;
  error: boolean;
  capped: boolean;
  source: DigestSource;
  partial: boolean;
  stale: boolean;
  generatedAt: string | null;
  busy: boolean;
  noNew: boolean;
  freshCapped: boolean;
  freshFailed: boolean;
  reload: () => Promise<void>;
  refreshDifferent: () => Promise<void>;
}

// 관심사별 다이제스트 상태 관리
export function useDigests(interests: string[]): DigestState {
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [capped, setCapped] = useState(false);
  const [source, setSource] = useState<DigestSource>("network");
  const [partial, setPartial] = useState(false);
  const [stale, setStale] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noNew, setNoNew] = useState(false);
  const [freshCapped, setFreshCapped] = useState(false);
  const [freshFailed, setFreshFailed] = useState(false);

  const key = interests.join(",");

  // 현재 관심사 다이제스트 갱신
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getDigests(key ? key.split(",") : []);
      setItems(result.items);
      setCapped(result.capped);
      setSource(result.source);
      setPartial(result.partial);
      setStale(result.stale);
      setGeneratedAt(result.generatedAt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [key]);

  // 다른 뉴스 목록 갱신
  const refreshDifferent = useCallback(async () => {
    setBusy(true);
    setNoNew(false);
    setFreshCapped(false);
    setFreshFailed(false);
    try {
      const result = await getFreshDigests(key ? key.split(",") : []);
      if (
        result.source === "network" &&
        result.items.length > 0 &&
        !result.stale
      ) {
        setItems(result.items);
        setCapped(result.capped);
        setSource("network");
        setPartial(result.partial);
        setStale(false);
        setGeneratedAt(result.generatedAt);
      } else if (result.capped) {
        setFreshCapped(true);
      } else if (result.source === "unavailable" || result.stale) {
        setFreshFailed(true);
      } else {
        setNoNew(true);
      }
    } catch {
      setFreshFailed(true);
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
    partial,
    stale,
    generatedAt,
    busy,
    noNew,
    freshCapped,
    freshFailed,
    reload,
    refreshDifferent,
  };
}
