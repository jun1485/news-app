import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { openExternal } from '../util/link';
import type { AppVersionInfo } from '../util/appVersion';
import { theme } from '../theme';

interface Props {
  info: AppVersionInfo;
  onClose: () => void;
  onSkip: () => void;
}

// 신규 버전 안내 레이어 — 스토어 이동·보류 선택 제공
export function UpdateNotice({ info, onClose, onSkip }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  // 등장 연출 — 모션 최소화 시 즉시 표시
  useEffect(() => {
    if (reduce) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, reduce]);

  // 스토어 페이지 이동
  const openStore = () => {
    void openExternal(info.storeUrl);
    onClose();
  };

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.backdrop, { opacity: anim }]} />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}
      >
        <Text style={styles.title}>새 버전이 나왔어요</Text>
        <Text style={styles.version}>버전 {info.latestVersion}</Text>

        {info.highlights.length > 0 && (
          <View style={styles.list}>
            {info.highlights.map((line) => (
              <Text key={line} style={styles.item}>
                · {line}
              </Text>
            ))}
          </View>
        )}

        <PressableScale
          style={styles.primary}
          onPress={openStore}
          accessibilityRole="button"
          accessibilityLabel="스토어에서 업데이트"
        >
          <Text style={styles.primaryText}>업데이트</Text>
        </PressableScale>

        <View style={styles.row}>
          <PressableScale
            style={styles.ghost}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="나중에 하기"
          >
            <Text style={styles.ghostText}>나중에</Text>
          </PressableScale>
          <PressableScale
            style={styles.ghost}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="이 버전 다시 보지 않기"
          >
            <Text style={styles.ghostText}>이 버전 건너뛰기</Text>
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,24,39,0.45)' },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.color.text },
  version: { marginTop: theme.space.xs, fontSize: 13, color: theme.color.sub },
  list: { marginTop: theme.space.md },
  item: { fontSize: 14, color: theme.color.text, lineHeight: 22 },
  primary: {
    marginTop: theme.space.lg,
    backgroundColor: theme.color.primary,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space.sm },
  ghost: { paddingVertical: theme.space.sm, paddingHorizontal: theme.space.xs },
  ghostText: { color: theme.color.sub, fontSize: 13 },
});
