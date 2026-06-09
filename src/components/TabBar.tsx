import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from './PressableScale';
import { theme } from '../theme';

type Tab = 'feed' | 'settings';

interface Props {
  current: Tab;
  onChange: (tab: Tab) => void;
}

// 하단 탭 바 — 피드/설정 전환
export function TabBar({ current, onChange }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <TabButton label="오늘의 뉴스" active={current === 'feed'} onPress={() => onChange('feed')} />
      <TabButton label="설정" active={current === 'settings'} onPress={() => onChange('settings')} />
    </View>
  );
}

// 탭 1개 버튼
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.label, active && styles.active]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  tab: { flex: 1, paddingVertical: theme.space.md, alignItems: 'center' },
  label: { color: theme.color.sub, fontSize: 14 },
  active: { color: theme.color.primary, fontWeight: '700' },
});
