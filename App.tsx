import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LoadingMascot } from './src/components/LoadingMascot';
import { ScreenFade } from './src/components/ScreenFade';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { TabBar } from './src/components/TabBar';
import { UpdateNotice } from './src/components/UpdateNotice';
import { loadInterests, saveInterests } from './src/storage/interests';
import { useAppUpdate } from './src/hooks/useAppUpdate';
import { syncDailyReminder } from './src/notifications/dailyNewsReminder';
import type { DigestItem } from './src/types';
import { theme } from './src/theme';

type Tab = 'feed' | 'settings';

// 앱 루트 — 관심사 로드 상태에 따라 온보딩/메인 분기, 탭 전환·상세 오버레이 수동 내비게이션
export default function App() {
  const [interests, setInterests] = useState<string[] | null>(null); // null=로딩중
  const [tab, setTab] = useState<Tab>('feed');
  const [selected, setSelected] = useState<DigestItem | null>(null); // 상세 오버레이 대상
  const update = useAppUpdate();

  // 최초 진입 시 저장된 관심사 로드
  useEffect(() => {
    loadInterests().then(setInterests);
  }, []);

  // 저장된 알림 설정 기준 매일 오전 9시 예약 동기화(앱 시작 1회)
  useEffect(() => {
    void syncDailyReminder();
  }, []);

  // 관심사 확정 저장 후 상태 반영(온보딩/설정 공통)
  const commitInterests = useCallback(async (list: string[]) => {
    await saveInterests(list);
    setInterests(list);
    setTab('feed');
  }, []);

  // 상세 닫기 — 상세 화면 뒤로가기 구독 재등록 방지용 고정 참조
  const closeDetail = useCallback(() => setSelected(null), []);

  // 안드로이드 하드웨어 뒤로가기 — 설정→피드(상세는 DetailScreen이 자체 처리)
  useEffect(() => {
    const onBack = (): boolean => {
      if (tab === 'settings') {
        setTab('feed');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [tab]);

  // 베이스 화면(로딩/온보딩/메인) — 상세는 그 위에 오버레이
  const baseKey = interests === null ? 'loading' : interests.length === 0 ? 'onboarding' : tab;

  // 전환 방향 — 단계 순서가 커지면 오른쪽, 작아지면 왼쪽에서 슬라이드
  const orderOf = (k: string): number => ({ loading: 0, onboarding: 1, feed: 2, settings: 3 }[k] ?? 0);
  const prevOrder = useRef(orderOf(baseKey));
  const enterFrom: 'right' | 'left' = orderOf(baseKey) >= prevOrder.current ? 'right' : 'left';
  useEffect(() => {
    prevOrder.current = orderOf(baseKey);
  }, [baseKey]);

  let base: ReactNode;
  if (interests === null) {
    base = (
      <View style={styles.center}>
        <LoadingMascot />
      </View>
    );
  } else if (interests.length === 0) {
    base = <OnboardingScreen onComplete={commitInterests} />;
  } else {
    base = (
      <>
        <View style={styles.body}>
          {tab === 'feed' ? (
            <FeedScreen interests={interests} onSelect={setSelected} />
          ) : (
            <SettingsScreen interests={interests} onSave={commitInterests} />
          )}
        </View>
        <TabBar current={tab} onChange={setTab} />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <View
          style={styles.body}
          importantForAccessibility={selected || update.info ? 'no-hide-descendants' : 'auto'}
        >
          <ScreenFade screenKey={baseKey} enterFrom={enterFrom}>
            {base}
          </ScreenFade>
        </View>
        {selected && <DetailScreen item={selected} onBack={closeDetail} />}
        {update.info && <UpdateNotice info={update.info} onClose={update.close} onSkip={update.skip} />}
      </View>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
});
