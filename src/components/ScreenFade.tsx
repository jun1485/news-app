import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

interface Props {
  screenKey: string;
  enterFrom?: 'right' | 'left';
  children: ReactNode;
}

// 화면 전환 — screenKey 변경 시 진행 방향(좌/우)에서 슬라이드+페이드 인(모션최소화면 즉시)
export function ScreenFade({ screenKey, enterFrom = 'right', children }: Props) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateX.setValue(enterFrom === 'left' ? -48 : 48);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, speed: 12, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [screenKey, enterFrom, reduce, opacity, translateX]);

  return <Animated.View style={[styles.fill, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
