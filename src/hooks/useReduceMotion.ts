import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// 모션 최소화(reduce motion) 설정 구독 — 화면 전환 애니메이션 분기용
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
