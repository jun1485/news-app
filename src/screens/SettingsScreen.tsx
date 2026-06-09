import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InterestPicker } from '../components/InterestPicker';
import { PressableScale } from '../components/PressableScale';
import { openExternal, sendMail } from '../util/link';
import { PRIVACY_URL } from '../config';
import { theme } from '../theme';

interface Props {
  interests: string[];
  onSave: (selected: string[]) => void;
}

// 설정 화면 — 관심사 편집 + 문의·신고
export function SettingsScreen({ interests, onSave }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + theme.space.lg }]}>
      <Text style={styles.title}>관심사 편집</Text>
      <InterestPicker initial={interests} submitLabel="저장" onSubmit={onSave} />

      <View style={styles.section}>
        <Text style={styles.label}>지원</Text>
        <PressableScale
          style={styles.row}
          onPress={() => sendMail('[AI 뉴스 다이제스트] 문의')}
          accessibilityRole="button"
          accessibilityLabel="문의하기"
        >
          <Text style={styles.rowText}>문의하기</Text>
        </PressableScale>
        <PressableScale
          style={styles.row}
          onPress={() => sendMail('[AI 뉴스 다이제스트] 콘텐츠 신고', '신고 사유:\n')}
          accessibilityRole="button"
          accessibilityLabel="AI 요약 오류·콘텐츠 신고"
        >
          <Text style={styles.rowText}>AI 요약 오류·콘텐츠 신고</Text>
        </PressableScale>
        <PressableScale
          style={styles.row}
          onPress={() => openExternal(PRIVACY_URL)}
          accessibilityRole="link"
          accessibilityLabel="개인정보처리방침 열기"
        >
          <Text style={styles.rowText}>개인정보처리방침</Text>
        </PressableScale>
      </View>

      <Text style={styles.footer}>버전 1.0.0</Text>
      <Text style={styles.footer}>
        본 앱은 기사 원문을 저장하지 않고 제목·출처·AI 요약과 원문 링크만 제공합니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: theme.space.lg, gap: theme.space.md },
  title: { fontSize: 22, fontWeight: '800', color: theme.color.text },
  section: { marginTop: theme.space.md, gap: theme.space.sm },
  label: { fontSize: 14, fontWeight: '700', color: theme.color.text },
  row: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.md,
  },
  rowText: { fontSize: 15, color: theme.color.text },
  footer: { fontSize: 12, color: theme.color.sub },
});
