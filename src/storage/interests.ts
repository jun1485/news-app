import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'selected_interests_v1';

// 저장된 관심사 목록 로드 — 없으면 빈 배열
export async function loadInterests(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// 관심사 목록 저장
export async function saveInterests(list: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
