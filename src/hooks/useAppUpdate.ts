import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AppVersionInfo } from '../util/appVersion';
import { currentAppVersion, fetchAppVersion, isNewerVersion } from '../util/appVersion';
import { loadSkippedVersion, saveSkippedVersion } from '../storage/updatePrefs';

// 업데이트 안내 상태
export interface AppUpdateState {
  info: AppVersionInfo | null;
  close: () => void;
  skip: () => void;
}

// 신규 버전 안내 대상 여부 판단 및 노출 상태 관리
export function useAppUpdate(): AppUpdateState {
  const [info, setInfo] = useState<AppVersionInfo | null>(null);

  // 앱 시작 시 배포 버전 확인 — 웹은 항상 최신이라 제외
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    void (async () => {
      const latest = await fetchAppVersion();
      if (!alive || !latest) return;
      if (!isNewerVersion(latest.latestVersion, currentAppVersion())) return;
      const skipped = await loadSkippedVersion();
      if (!alive || skipped === latest.latestVersion) return;
      setInfo(latest);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 이번 실행에서만 안내 숨김
  const close = useCallback(() => setInfo(null), []);

  // 해당 버전 안내 재노출 차단
  const skip = useCallback(() => {
    setInfo((prev) => {
      if (prev) void saveSkippedVersion(prev.latestVersion);
      return null;
    });
  }, []);

  return { info, close, skip };
}
