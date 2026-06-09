import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'device_id_v1';

// 기기 식별자 로드 — 없으면 생성·저장(서버 레이트리밋 버킷용)
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(KEY, id);
  return id;
}
