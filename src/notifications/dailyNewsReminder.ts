import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { loadReminderEnabled } from '../storage/notificationPrefs';

// 일일 알림 고정 식별자 — 동일 id 재예약으로 중복 누적 차단
const REMINDER_ID = 'daily-news-9am';
// Android 알림 채널 식별자 — app.json defaultChannel과 일치
const CHANNEL_ID = 'daily-news';
// 알림 발송 시각(매일 오전 9시)
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

// 포그라운드 수신 알림 표시 동작 정의(앱 실행 중에도 배너·목록 노출)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 알림 채널 선등록 — 8.0+ 미등록 시 알림 표시 누락
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '데일리 뉴스 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

// 알림 권한 확보 — 미결정 시에만 요청, 거부·재요청 불가 상태면 생략
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return requested.granted;
}

// 매일 오전 9시 알림 등록 — 기존 예약 취소 후 재등록
async function scheduleReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: '오늘의 뉴스 다이제스트',
      body: '관심 분야 뉴스가 준비됐어요. 오늘의 소식을 확인해 보세요.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY, // 매일 반복(repeats 불필요)
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID, // Android 전용, iOS에서는 무시
    },
  });
}

// 일일 알림 활성화 — 채널·권한 확보 후 예약, 권한 허용 여부 반환
export async function enableDailyReminder(): Promise<boolean> {
  await ensureChannel();
  if (!(await ensurePermission())) return false;
  await scheduleReminder();
  return true;
}

// 일일 알림 비활성화 — 예약 취소
export async function disableDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
}

// 저장된 설정에 맞춰 OS 예약 동기화(앱 시작 1회) — 활성 시 재예약, 비활성 시 취소
export async function syncDailyReminder(): Promise<void> {
  (await loadReminderEnabled()) ? await enableDailyReminder() : await disableDailyReminder();
}
