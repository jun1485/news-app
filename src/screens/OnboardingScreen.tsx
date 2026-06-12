import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InterestPicker } from '../components/InterestPicker';
import { theme } from '../theme';

interface Props {
  onComplete: (selected: string[]) => void;
}

// 온보딩 화면 — 관심사 최초 선택
export function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + theme.space.lg }]}>
      <Text style={styles.title}>관심사를 선택해주세요</Text>
      <Text style={styles.desc}>선택한 분야의 오늘 뉴스를 AI가 종합해 보여드려요.</Text>
      <InterestPicker initial={[]} submitLabel="시작하기" onSubmit={onComplete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: theme.space.lg, gap: theme.space.md },
  title: { fontSize: 24, fontWeight: '800', color: theme.color.text },
  desc: { fontSize: 15, color: theme.color.sub, marginBottom: theme.space.sm },
});
