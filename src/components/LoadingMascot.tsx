import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  label?: string;
}

// 로딩 중 응원 문구 순환
const MESSAGES = [
  '오늘의 뉴스를 모으는 중...',
  '신문을 넘겨보는 중...',
  'AI가 요약하는 중 ✍️',
  '거의 다 됐어요!',
];

const MASCOT_IMAGE = require('../../assets/splash-icon.png');
const MASCOT_SPRITE = require('../../assets/loading-mascot-sprite.png');
const FRAME_SIZE = 144;
const SPRITE_OFFSETS = [
  { x: 0, y: 0 },
  { x: -FRAME_SIZE, y: 0 },
  { x: 0, y: -FRAME_SIZE },
  { x: -FRAME_SIZE, y: -FRAME_SIZE },
] as const;

// 뉴스 로딩 상태 표시
export function LoadingMascot({ label }: Props) {
  const frameProgress = useRef(new Animated.Value(0)).current;
  const [msgIdx, setMsgIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // 모션 최소화 설정 반영
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // 신문 페이지 프레임 전환
  useEffect(() => {
    frameProgress.setValue(0);
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(frameProgress, {
        toValue: 4,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [frameProgress, reduceMotion]);

  // 로딩 문구 순환
  useEffect(() => {
    if (label || reduceMotion) return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1500);
    return () => clearInterval(id);
  }, [label, reduceMotion]);

  const text = label ?? MESSAGES[reduceMotion ? 0 : msgIdx];
  const frameOpacities = [
    frameProgress.interpolate({
      inputRange: [0, 0.7, 1, 3.7, 4],
      outputRange: [1, 1, 0, 0, 1],
    }),
    frameProgress.interpolate({
      inputRange: [0, 0.7, 1, 1.7, 2, 4],
      outputRange: [0, 0, 1, 1, 0, 0],
    }),
    frameProgress.interpolate({
      inputRange: [0, 1, 1.7, 2, 2.7, 3, 4],
      outputRange: [0, 0, 0, 1, 1, 0, 0],
    }),
    frameProgress.interpolate({
      inputRange: [0, 2, 2.7, 3, 3.7, 4],
      outputRange: [0, 0, 0, 1, 1, 0],
    }),
  ];

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="뉴스 불러오는 중">
      <View style={styles.stage}>
        {reduceMotion ? (
          <Image source={MASCOT_IMAGE} style={styles.mascot} resizeMode="contain" accessible={false} />
        ) : (
          <View style={styles.frame} accessible={false}>
            {/* 신문 넘김 장면 표시 */}
            {SPRITE_OFFSETS.map((spriteOffset, frameIndex) => (
              <Animated.View key={frameIndex} style={[styles.frameLayer, { opacity: frameOpacities[frameIndex] }]}>
                <Image
                  source={MASCOT_SPRITE}
                  style={[
                    styles.sprite,
                    { transform: [{ translateX: spriteOffset.x }, { translateY: spriteOffset.y }] },
                  ]}
                />
              </Animated.View>
            ))}
          </View>
        )}
        <View style={styles.shadow} />
      </View>
      <Text style={styles.label}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: theme.space.md, paddingVertical: theme.space.lg },
  stage: { width: 180, height: 180, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  mascot: { width: FRAME_SIZE, height: FRAME_SIZE },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE, overflow: 'hidden' },
  frameLayer: { position: 'absolute', inset: 0 },
  sprite: { position: 'absolute', width: FRAME_SIZE * 2, height: FRAME_SIZE * 2 },
  shadow: { width: 72, height: 9, borderRadius: 5, backgroundColor: '#000000', marginTop: 4, opacity: 0.14 },
  label: { fontSize: 14, color: theme.color.sub },
});
