import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let current = false; // 최근 확인된 모션 최소화 설정
const listeners = new Set<(v: boolean) => void>();
let started = false;

// 모션 최소화 설정 단일 구독 시작 — 화면 내 카드 다수에서 중복 구독 방지
function ensureSubscription(): void {
  if (started) return;
  started = true;
  const apply = (v: boolean) => {
    current = v;
    listeners.forEach((fn) => fn(v));
  };
  AccessibilityInfo.isReduceMotionEnabled().then(apply);
  AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
}

// 모션 최소화(reduce motion) 설정 구독 — 화면 전환 애니메이션 분기용
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(current);

  useEffect(() => {
    ensureSubscription();
    setReduce(current);
    listeners.add(setReduce);
    return () => {
      listeners.delete(setReduce);
    };
  }, []);

  return reduce;
}
