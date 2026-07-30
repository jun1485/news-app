import { Alert, Linking, Platform } from 'react-native';
import { CONTACT_EMAIL } from '../config';
import { isValidArticleUrl, newsSearchUrl, verifyArticleUrl } from './urlCheck';

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

// 원문 대체 경로 안내 — 헤드라인 뉴스 검색 이동 여부 확인
function askSearchFallback(title: string, message: string, headline: string): void {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '뉴스 검색', onPress: () => void openExternal(newsSearchUrl(headline)) },
  ]);
}

// 원문 링크 열기 — 형식·접근 검증 통과 시 열고, 실패 시 뉴스 검색으로 대체 안내
export async function openArticle(url: string, headline: string): Promise<void> {
  if (!isValidArticleUrl(url)) {
    askSearchFallback('원문 주소 오류', '원문 주소가 올바르지 않아요. 뉴스 검색으로 찾아볼까요?', headline);
    return;
  }
  // 웹은 교차 출처 제한으로 사전 확인이 불가해 바로 열기
  if (Platform.OS === 'web') {
    openWeb(url);
    return;
  }
  const { verdict, url: resolved } = await verifyArticleUrl(url);
  if (verdict === 'ok') {
    await openExternal(resolved);
    return;
  }
  if (verdict === 'missing') {
    askSearchFallback('원문을 찾을 수 없음', '원문이 삭제되거나 주소가 바뀐 것 같아요. 뉴스 검색으로 찾아볼까요?', headline);
    return;
  }
  // 오프라인·차단 등 확인 불가 — 사용자 선택으로 강제 열기 허용
  Alert.alert('원문 확인 실패', '원문 접속 여부를 확인하지 못했어요.', [
    { text: '취소', style: 'cancel' },
    { text: '뉴스 검색', onPress: () => void openExternal(newsSearchUrl(headline)) },
    { text: '그래도 열기', onPress: () => void openExternal(url) },
  ]);
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
