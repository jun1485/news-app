import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingMascot } from '../components/LoadingMascot';
import { PressableScale } from '../components/PressableScale';
import { NewsCard } from '../components/NewsCard';
import { useDigests } from '../hooks/useDigests';
import { CREDITS_ENABLED } from '../config';
import type { DigestItem } from '../types';
import { theme } from '../theme';

interface Props {
  interests: string[];
  onSelect: (item: DigestItem) => void;
}

// 피드 화면 — 관심사별 다이제스트 목록, 당겨서 새로고침
export function FeedScreen({ interests, onSelect }: Props) {
  const { items, loading, error, capped, source, lastUpdated, busy, noNew, freshCapped, reload, refreshDifferent } =
    useDigests(interests);
  const insets = useSafeAreaInsets();

  // 마지막 갱신 시각 표기(HH:MM)
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null;

  // 다른 뉴스 보기 — 출시 시 CREDITS_ENABLED면 여기서 크레딧 확인·차감 후 호출(현재 무료)
  const onMore = () => {
    if (CREDITS_ENABLED) {
      // 추후: 크레딧 잔량 확인·차감 로직
    }
    refreshDifferent();
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => <NewsCard item={item} index={index} onPress={onSelect} />}
      refreshing={loading}
      onRefresh={reload}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + theme.space.md }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>오늘의 뉴스</Text>
          <Text style={styles.disclaimer}>AI가 종합한 요약입니다. 정확한 내용은 원문을 확인하세요.</Text>
          {updatedLabel && <Text style={styles.meta}>마지막 갱신 {updatedLabel}</Text>}
          {source === 'static' && (
            <Text style={styles.notice}>실시간 연결이 지연돼 예시 데이터를 표시 중입니다. 당겨서 새로고침 해주세요.</Text>
          )}
          {source === 'cache' && <Text style={styles.meta}>오프라인 캐시 표시 중</Text>}
          {source === 'network' && capped && (
            <Text style={styles.notice}>일일 생성 한도에 도달해 일부는 캐시 결과만 표시됩니다.</Text>
          )}
          {error && <Text style={styles.notice}>불러오기에 실패했어요. 당겨서 새로고침 해주세요.</Text>}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingMascot />
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>표시할 뉴스가 없습니다.</Text>
            <PressableScale
              onPress={reload}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </PressableScale>
          </View>
        )
      }
      ListFooterComponent={
        items.length > 0 ? (
          <View style={styles.footer}>
            {freshCapped ? (
              <Text style={styles.footerNote}>오늘 새로고침 한도에 도달했어요. 내일 다시 시도해 주세요.</Text>
            ) : noNew ? (
              <Text style={styles.footerNote}>더 새로운 뉴스를 찾지 못했어요.</Text>
            ) : null}
            <PressableScale
              onPress={onMore}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="다른 뉴스 보기"
              style={[styles.moreBtn, busy && styles.moreBtnDisabled]}
            >
              <Text style={styles.moreText}>{busy ? '다른 뉴스 찾는 중...' : '🔄 다른 뉴스 보기'}</Text>
            </PressableScale>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.space.md },
  header: { marginBottom: theme.space.md, gap: theme.space.xs },
  title: { fontSize: 22, fontWeight: '800', color: theme.color.text },
  disclaimer: { fontSize: 12, color: theme.color.sub },
  meta: { fontSize: 12, color: theme.color.sub },
  notice: { fontSize: 12, color: theme.color.warn },
  emptyBox: { marginTop: theme.space.lg, alignItems: 'center', gap: theme.space.md },
  empty: { textAlign: 'center', color: theme.color.sub },
  retryBtn: {
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  retryText: { color: theme.color.chipOffText, fontWeight: '700' },
  footer: { marginTop: theme.space.md, alignItems: 'center', gap: theme.space.sm },
  footerNote: { fontSize: 12, color: theme.color.sub },
  moreBtn: {
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  moreBtnDisabled: { opacity: 0.5 },
  moreText: { color: theme.color.chipOffText, fontWeight: '700' },
});
