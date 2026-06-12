import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  label?: string;
}

// 로딩 중 응원 문구 로테이션
const MESSAGES = [
  '오늘의 뉴스를 모으는 중...',
  '기사를 훑어보는 중 🔎',
  'AI가 요약하는 중 ✍️',
  '거의 다 됐어요!',
];

// 로딩 마스코트 — 좌우로 뛰어다니며 찌그러졌다 늘어나는 병아리(무의존 Animated, 모션최소화 대응)
export function LoadingMascot({ label }: Props) {
  const hop = useRef(new Animated.Value(0)).current; // 0=착지 1=점프 정점
  const sway = useRef(new Animated.Value(0)).current; // 0=좌 1=우
  const [msgIdx, setMsgIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // 모션 최소화 설정 감지(전정장애·멀미 민감 대응)
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // 점프(스쿼시·스트레치) 루프 — 모션최소화면 미실행
  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [hop, reduceMotion]);

  // 좌우 왕복 루프 — 모션최소화면 미실행
  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [sway, reduceMotion]);

  // 문구 순환(커스텀 라벨·모션최소화면 생략)
  useEffect(() => {
    if (label || reduceMotion) return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1500);
    return () => clearInterval(id);
  }, [label, reduceMotion]);

  const text = label ?? MESSAGES[reduceMotion ? 0 : msgIdx];

  // 모션최소화 — 정지 마스코트만 표시
  if (reduceMotion) {
    return (
      <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="뉴스 불러오는 중">
        <View style={styles.stage}>
          <Text style={styles.mascot}>🐥</Text>
          <View style={[styles.shadow, { opacity: 0.18 }]} />
        </View>
        <Text style={styles.label}>{text}</Text>
      </View>
    );
  }

  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const scaleY = hop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.78, 1.15, 1.04] });
  const scaleX = hop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1.22, 0.9, 0.98] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-22, 22] });
  const rotate = sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-9deg', '0deg', '9deg'] });
  const shadowScaleX = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const shadowOpacity = hop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.06] });

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="뉴스 불러오는 중">
      <View style={styles.stage}>
        <Animated.Text
          style={[styles.mascot, { transform: [{ translateX }, { translateY }, { rotate }, { scaleX }, { scaleY }] }]}
        >
          🐥
        </Animated.Text>
        <Animated.View
          style={[styles.shadow, { opacity: shadowOpacity, transform: [{ translateX }, { scaleX: shadowScaleX }] }]}
        />
      </View>
      <Text style={styles.label}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: theme.space.md, paddingVertical: theme.space.lg },
  stage: { width: 140, height: 88, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  mascot: { fontSize: 46 },
  shadow: { width: 42, height: 9, borderRadius: 5, backgroundColor: '#000000', marginTop: 4 },
  label: { fontSize: 14, color: theme.color.sub },
});
