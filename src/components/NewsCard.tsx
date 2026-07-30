import { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import type { DigestItem } from '../types';
import { PressableScale } from './PressableScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { theme } from '../theme';

interface Props {
  item: DigestItem;
  index: number;
  onPress: (item: DigestItem) => void;
}

// 세션 내 이미 등장 애니를 재생한 카드 id — FlatList 리마운트(스크롤) 시 재생 방지
const animatedIds = new Set<string>();

// 뉴스 1건 카드 — 최초 1회만 인덱스 순서대로 떠오르는 등장 + 출처표기(정책 충족)
function NewsCardBase({ item, index, onPress }: Props) {
  const reduce = useReduceMotion();
  const seen = animatedIds.has(item.id);
  const enter = useRef(new Animated.Value(reduce || seen ? 1 : 0)).current;

  // 최초 등장만 지연 애니(이미 본 카드·모션최소화는 즉시 표시)
  useEffect(() => {
    if (reduce || seen) {
      enter.setValue(1);
      return;
    }
    animatedIds.add(item.id);
    Animated.timing(enter, {
      toValue: 1,
      duration: 360,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, reduce, seen, index, item.id]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const select = useCallback(() => onPress(item), [onPress, item]);

  return (
    <Animated.View style={[styles.wrap, { opacity: enter, transform: [{ translateY }, { scale }] }]}>
      <PressableScale
        style={styles.card}
        onPress={select}
        accessibilityRole="button"
        accessibilityLabel={`${item.category} 뉴스, ${item.headline}`}
      >
        <Text style={styles.cat}>{item.category}</Text>
        <Text style={styles.headline}>{item.headline}</Text>
        <Text style={styles.summary} numberOfLines={2}>
          {item.summary}
        </Text>
        <Text style={styles.meta}>
          {item.sourceName}
          {item.publishedAt ? ` · ${item.publishedAt}` : ''}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

// 상세 진입·복귀 시 목록 재렌더 비용 차단
export const NewsCard = memo(NewsCardBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.space.sm },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: theme.space.xs,
  },
  cat: { color: theme.color.primary, fontSize: 12, fontWeight: '700' },
  headline: { color: theme.color.text, fontSize: 16, fontWeight: '700' },
  summary: { color: theme.color.sub, fontSize: 14, lineHeight: 20 },
  meta: { color: theme.color.sub, fontSize: 12, marginTop: theme.space.xs },
});
