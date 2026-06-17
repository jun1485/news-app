import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'daily_news_reminder_v1';

// 일일 뉴스 알림 사용 설정 로드 — 미저장 시 기본 활성
export async function loadReminderEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? true : raw === '1';
}

// 일일 뉴스 알림 사용 설정 저장
export async function saveReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}
