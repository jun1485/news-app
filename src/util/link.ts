import { Alert, Linking, Platform } from 'react-native';
import { CONTACT_EMAIL } from '../config';

// 웹 새 탭 열기
function openWeb(url: string): void {
  (globalThis as { open?: (u: string, target?: string) => void }).open?.(url, '_blank');
}

// 원문 외부 링크 열기 — 실패 시 안내(미처리 rejection 방지)
export async function openExternal(url: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      openWeb(url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('열 수 없음', '링크를 열 수 없어요. 잠시 후 다시 시도해주세요.');
  }
}

// 문의·신고 메일 작성 열기 — 메일 앱 없으면 주소 안내로 폴백
export async function sendMail(subject: string, body = ''): Promise<void> {
  const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    if (Platform.OS === 'web') {
      openWeb(url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('메일 앱 없음', `메일 앱을 열 수 없어요. ${CONTACT_EMAIL} 으로 보내주세요.`);
  }
}
