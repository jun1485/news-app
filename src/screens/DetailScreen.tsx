import { useCallback, useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useWebBackHandler } from '../hooks/useWebBackHandler';
import type { DigestItem } from '../types';
import { openExternal, sendMail } from '../util/link';
import { theme } from '../theme';

interface Props {
  item: DigestItem;
  onBack: () => void;
}

// 상세 화면 — 오른쪽 슬라이드 인/아웃 오버레이, 요약 + 원문 링크아웃(본문 미표시)
export function DetailScreen({ item, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const anim = useRef(new Animated.Value(reduce ? 1 : 0)).current; // 패널 슬라이드/스케일
  const content = useRef(new Animated.Value(reduce ? 1 : 0)).current; // 내용 지연 페이드업
  const closing = useRef(false); // 닫힘 애니 중복 실행 가드

  // 닫기 — 슬라이드 아웃 후 onBack(모션최소화면 즉시), 중복 입력 무시
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduce) {
      onBack();
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      () => onBack(),
    );
  }, [anim, reduce, onBack]);

  // 진입 슬라이드 인 + 내용 지연 페이드업(2단 연출)
  useEffect(() => {
    if (reduce) return;
    Animated.timing(anim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(content, { toValue: 1, duration: 320, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim, content, reduce]);

  // 상세에서 하드웨어 뒤로가기 → 슬라이드 아웃 닫기
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // 웹 브라우저 뒤로가기 → 페이지 이탈 대신 상세만 닫기
  useWebBackHandler(close);

  // 현재 요약 신고 메일 작성(제목·원문 프리필)
  const reportItem = () =>
    sendMail(
      '[AI 뉴스 다이제스트] 요약 신고',
      `신고 대상 요약:\n${item.headline}\n원문: ${item.sourceUrl}\n\n신고 사유:\n`,
    );

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const contentY = content.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View
      accessibilityViewIsModal
      style={[styles.root, { opacity: anim, transform: [{ translateX }, { scale }] }]}
    >
      <Pressable
        style={[styles.back, { paddingTop: insets.top + theme.space.sm }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={8}
      >
        <Text style={styles.backText}>‹ 뒤로</Text>
      </Pressable>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + theme.space.lg }]}>
        <Animated.View style={[styles.body, { opacity: content, transform: [{ translateY: contentY }] }]}>
          <Text style={styles.cat}>{item.category}</Text>
          <Text style={styles.headline}>{item.headline}</Text>
          <Text style={styles.meta}>
            {item.sourceName}
            {item.publishedAt ? ` · ${item.publishedAt}` : ''}
          </Text>
          <Text style={styles.summary}>{item.summary}</Text>
          <PressableScale
            style={styles.link}
            onPress={() => openExternal(item.sourceUrl)}
            accessibilityRole="link"
            accessibilityLabel={`원문 보기, ${item.sourceName}`}
          >
            <Text style={styles.linkText}>원문 보기 ({item.sourceName})</Text>
          </PressableScale>
          <Text style={styles.disclaimer}>AI가 종합한 요약입니다. 정확한 내용은 원문을 확인하세요.</Text>
          <Pressable onPress={reportItem} accessibilityRole="button" accessibilityLabel="요약 오류·문제 신고">
            <Text style={styles.report}>요약 오류·문제 신고</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.color.bg },
  back: { paddingHorizontal: theme.space.md, paddingBottom: theme.space.sm },
  backText: { color: theme.color.primary, fontSize: 16, fontWeight: '600' },
  scroll: { padding: theme.space.lg },
  body: { gap: theme.space.sm },
  cat: { color: theme.color.primary, fontSize: 13, fontWeight: '700' },
  headline: { fontSize: 22, fontWeight: '800', color: theme.color.text },
  meta: { color: theme.color.sub, fontSize: 13 },
  summary: { fontSize: 16, lineHeight: 24, color: theme.color.text, marginTop: theme.space.sm },
  link: { backgroundColor: theme.color.primary, paddingVertical: theme.space.md, borderRadius: theme.radius.md, alignItems: 'center', marginTop: theme.space.md },
  linkText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disclaimer: { fontSize: 12, color: theme.color.sub, marginTop: theme.space.md },
  report: { fontSize: 12, color: theme.color.sub, textDecorationLine: 'underline', marginTop: theme.space.sm },
});
