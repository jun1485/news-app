import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { loadReminderEnabled, saveReminderEnabled } from '../storage/notificationPrefs';
import { disableDailyReminder, enableDailyReminder } from '../notifications/dailyNewsReminder';

interface DailyReminder {
  enabled: boolean;
  toggle: (next: boolean) => Promise<void>;
}

// 일일 뉴스 알림 토글 상태 관리 — 저장 설정 로드 + 권한 결과 반영
export function useDailyNewsReminder(): DailyReminder {
  const [enabled, setEnabled] = useState(false);

  // 저장된 사용 설정 최초 로드
  useEffect(() => {
    loadReminderEnabled().then(setEnabled);
  }, []);

  // 토글 변경 — 켜면 권한·예약, 권한 거부 시 off 복귀·설정 안내, 끄면 예약 취소
  const toggle = useCallback(async (next: boolean) => {
    if (next && !(await enableDailyReminder())) {
      // 권한 미허용 — 설정 저장하지 않고 off 유지 + 시스템 설정 진입 안내
      setEnabled(false);
      await saveReminderEnabled(false);
      Alert.alert('알림 권한 필요', '기기 설정에서 알림을 허용해 주세요.', [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (!next) await disableDailyReminder();
    setEnabled(next);
    await saveReminderEnabled(next);
  }, []);

  return { enabled, toggle };
}
