import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// 웹 전용 브라우저 히스토리 접근(타입 안전 경계)
type WebNav = {
  history?: { pushState: (state: unknown, title: string) => void; back: () => void };
  addEventListener?: (type: string, handler: () => void) => void;
  removeEventListener?: (type: string, handler: () => void) => void;
};

// 웹 브라우저 뒤로가기를 가로채 페이지 이탈 대신 onBack 실행(마운트 동안 트랩 히스토리 1개 유지)
export function useWebBackHandler(onBack: () => void): void {
  const cb = useRef(onBack);
  cb.current = onBack;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = globalThis as WebNav;
    if (!w.history || !w.addEventListener || !w.removeEventListener) return;

    let poppedByUser = false; // 브라우저 뒤로가기로 닫혔는지(트랩 정리 분기)
    w.history.pushState({ trap: true }, '');
    const handler = () => {
      poppedByUser = true;
      cb.current();
    };
    w.addEventListener('popstate', handler);

    return () => {
      w.removeEventListener?.('popstate', handler);
      // 앱 내부 동작으로 닫힌 경우, 남은 트랩 히스토리 항목 제거
      if (!poppedByUser) w.history?.back();
    };
  }, []);
}
