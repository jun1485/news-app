import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingMascot } from "../components/LoadingMascot";
import { PressableScale } from "../components/PressableScale";
import { NewsCard } from "../components/NewsCard";
import { useDigests } from "../hooks/useDigests";
import type { DigestItem } from "../types";
import { theme } from "../theme";

interface Props {
  interests: string[];
  onSelect: (item: DigestItem) => void;
}

// 관심사별 뉴스 피드 표시
export function FeedScreen({ interests, onSelect }: Props) {
  const {
    items,
    loading,
    error,
    capped,
    source,
    partial,
    stale,
    generatedAt,
    outdatedHidden,
    busy,
    noNew,
    freshCapped,
    freshFailed,
    reload,
    refreshDifferent,
  } = useDigests(interests);
  const insets = useSafeAreaInsets();

  // 뉴스 생성 시각 표시
  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const refreshing = loading && items.length > 0;

  // 카드 렌더러 — 상세 복귀 시 행 재렌더 방지용 고정 참조
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<DigestItem>) => (
      <NewsCard item={item} index={index} onPress={onSelect} />
    ),
    [onSelect],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshing={false}
      onRefresh={reload}
      contentContainerStyle={[
        styles.list,
        { paddingTop: insets.top + theme.space.md },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          {refreshing && (
            <Modal transparent statusBarTranslucent animationType="fade">
              <View
                style={styles.loadingOverlay}
                accessibilityLiveRegion="polite"
                accessibilityRole="progressbar"
                accessibilityLabel="최신 뉴스 불러오는 중"
              >
                <LoadingMascot label="최신 뉴스를 불러오는 중..." />
              </View>
            </Modal>
          )}
          <Text style={styles.title}>오늘의 뉴스</Text>
          <Text style={styles.disclaimer}>
            AI가 종합한 요약입니다. 정확한 내용은 원문을 확인하세요.
          </Text>
          {generatedLabel && (
            <Text style={styles.meta}>뉴스 생성 기준 {generatedLabel}</Text>
          )}
          {outdatedHidden && items.length > 0 && (
            <Text style={styles.meta}>오늘 게시된 뉴스만 표시합니다.</Text>
          )}
          {refreshing ? null : (
            <>
              {source === "static" && (
                <Text style={styles.notice}>
                  실시간 서비스 설정이 없어 예시 데이터를 표시 중입니다.
                </Text>
              )}
              {source === "cache" && (
                <>
                  <Text style={styles.notice}>
                    최신 뉴스를 불러오지 못해 이전 뉴스를 표시 중입니다.
                  </Text>
                  <PressableScale
                    onPress={reload}
                    accessibilityRole="button"
                    accessibilityLabel="최신 뉴스 다시 불러오기"
                    style={styles.headerRetryBtn}
                  >
                    <Text style={styles.headerRetryText}>
                      최신 뉴스 다시 불러오기
                    </Text>
                  </PressableScale>
                </>
              )}
              {source === "unavailable" && (
                <Text style={styles.notice}>
                  최신 뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </Text>
              )}
              {source === "empty" && (
                <Text style={styles.meta}>
                  선택한 관심사에 해당하는 최신 뉴스를 찾지 못했습니다.
                </Text>
              )}
              {source === "network" && partial && (
                <Text style={styles.notice}>
                  일부 관심사의 최신 뉴스를 불러오지 못했습니다.
                </Text>
              )}
              {source === "network" && stale && (
                <Text style={styles.notice}>
                  최신 뉴스 생성에 실패해 이전 성공 데이터를 표시 중입니다.
                </Text>
              )}
              {capped && (
                <Text style={styles.notice}>
                  일일 생성 한도에 도달해 일부는 캐시 결과만 표시됩니다.
                </Text>
              )}
              {error && (
                <Text style={styles.notice}>
                  불러오기에 실패했어요. 당겨서 새로고침 해주세요.
                </Text>
              )}
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingMascot />
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>
              {outdatedHidden
                ? "오늘 게시된 뉴스가 아직 없습니다."
                : source === "empty"
                  ? "조건에 맞는 최신 뉴스가 없습니다."
                  : "최신 뉴스를 불러올 수 없습니다."}
            </Text>
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
              <Text style={styles.footerNote}>
                오늘 새로고침 한도에 도달했어요. 내일 다시 시도해 주세요.
              </Text>
            ) : freshFailed ? (
              <Text style={styles.footerNote}>
                다른 뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </Text>
            ) : noNew ? (
              <Text style={styles.footerNote}>
                더 새로운 뉴스를 찾지 못했어요.
              </Text>
            ) : null}
            <PressableScale
              onPress={refreshDifferent}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="다른 뉴스 보기"
              accessibilityState={{ busy, disabled: busy }}
              style={[styles.moreBtn, busy && styles.moreBtnDisabled]}
            >
              {busy ? (
                <View style={styles.progressRow}>
                  <ActivityIndicator
                    size="small"
                    color={theme.color.chipOffText}
                  />
                  <Text style={styles.moreText}>다른 뉴스 찾는 중...</Text>
                </View>
              ) : (
                <Text style={styles.moreText}>🔄 다른 뉴스 보기</Text>
              )}
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
  title: { fontSize: 22, fontWeight: "800", color: theme.color.text },
  disclaimer: { fontSize: 12, color: theme.color.sub },
  meta: { fontSize: 12, color: theme.color.sub },
  notice: { fontSize: 12, color: theme.color.warn },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  headerRetryBtn: {
    alignSelf: "flex-start",
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
  },
  headerRetryText: {
    color: theme.color.chipOffText,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyBox: {
    marginTop: theme.space.lg,
    alignItems: "center",
    gap: theme.space.md,
  },
  empty: { textAlign: "center", color: theme.color.sub },
  retryBtn: {
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  retryText: { color: theme.color.chipOffText, fontWeight: "700" },
  footer: {
    marginTop: theme.space.md,
    alignItems: "center",
    gap: theme.space.sm,
  },
  footerNote: { fontSize: 12, color: theme.color.sub },
  moreBtn: {
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  moreBtnDisabled: { opacity: 0.5 },
  moreText: { color: theme.color.chipOffText, fontWeight: "700" },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.82)",
  },
});
