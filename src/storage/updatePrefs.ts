import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'update_notice_skipped_v1';

// 업데이트 안내 보류 처리한 버전 로드
export async function loadSkippedVersion(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

// 업데이트 안내 보류 처리한 버전 저장
export async function saveSkippedVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(KEY, version);
}
