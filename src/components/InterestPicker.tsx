import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PRESET_CATEGORIES } from '../data/interests';
import { PressableScale } from './PressableScale';
import { theme } from '../theme';

interface Props {
  initial: string[];
  submitLabel: string;
  onSubmit: (selected: string[]) => void;
}

const PRESETS: readonly string[] = PRESET_CATEGORIES;

// 관심사 다중 선택(프리셋 칩 + 직접 입력 키워드) + 확정 버튼 — 온보딩/설정 공용
export function InterestPicker({ initial, submitLabel, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [keyword, setKeyword] = useState('');

  // 프리셋 칩 선택/해제 토글(커스텀 키워드 칩 제거에도 사용)
  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  };

  // 직접 입력 키워드 추가 — 공백 정규화·1~20자 제한·중복 방지
  const addKeyword = () => {
    const trimmed = keyword.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 1 || trimmed.length > 20) return;
    setSelected((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setKeyword('');
  };

  // 선택 항목 중 프리셋에 없는 직접 입력 키워드
  const customKeywords = selected.filter((s) => !PRESETS.includes(s));
  const empty = selected.length === 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>관심 분야</Text>
      <View style={styles.chips}>
        {PRESET_CATEGORIES.map((category) => {
          const on = selected.includes(category);
          return (
            <PressableScale
              key={category}
              onPress={() => toggle(category)}
              accessibilityRole="button"
              accessibilityLabel={category}
              accessibilityState={{ selected: on }}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
            >
              <Text style={on ? styles.chipOnText : styles.chipOffText}>{category}</Text>
            </PressableScale>
          );
        })}
      </View>

      <Text style={styles.label}>키워드 직접 추가</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={addKeyword}
          placeholder="예: 반도체, 부동산, 손흥민"
          placeholderTextColor={theme.color.sub}
          style={styles.input}
          returnKeyType="done"
          maxLength={20}
        />
        <PressableScale onPress={addKeyword} accessibilityRole="button" accessibilityLabel="키워드 추가" style={styles.addBtn}>
          <Text style={styles.addBtnText}>추가</Text>
        </PressableScale>
      </View>

      {customKeywords.length > 0 && (
        <View style={styles.chips}>
          {customKeywords.map((kw) => (
            <PressableScale
              key={kw}
              onPress={() => toggle(kw)}
              accessibilityRole="button"
              accessibilityLabel={`${kw} 키워드 삭제`}
              style={[styles.chip, styles.chipOn]}
            >
              <Text style={styles.chipOnText} numberOfLines={1}>
                {kw} ✕
              </Text>
            </PressableScale>
          ))}
        </View>
      )}

      <PressableScale
        disabled={empty}
        onPress={() => onSubmit(selected)}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: empty }}
        style={[styles.submit, empty && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.md },
  label: { fontSize: 14, fontWeight: '700', color: theme.color.text, marginTop: theme.space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  chip: { paddingVertical: theme.space.sm, paddingHorizontal: theme.space.md, borderRadius: theme.radius.lg },
  chipOn: { backgroundColor: theme.color.chipOn },
  chipOff: { backgroundColor: theme.color.chipOff },
  chipOnText: { color: theme.color.chipOnText, fontWeight: '600' },
  chipOffText: { color: theme.color.chipOffText },
  inputRow: { flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    color: theme.color.text,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: theme.color.chipOff,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
  },
  addBtnText: { color: theme.color.chipOffText, fontWeight: '700' },
  submit: { backgroundColor: theme.color.primary, paddingVertical: theme.space.md, borderRadius: theme.radius.md, alignItems: 'center', marginTop: theme.space.sm },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
