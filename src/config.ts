// 백엔드 Worker 베이스 URL — 미설정 시 정적 데이터로 동작(EXPO_PUBLIC_ 빌드 주입)
export const WORKER_URL: string = (process.env.EXPO_PUBLIC_WORKER_URL ?? '').trim().replace(/\/+$/, '');

// 문의·신고 수신 이메일
export const CONTACT_EMAIL = 'wnwjdwns1@naver.com';

// 개인정보처리방침 공개 URL(Worker 서빙)
export const PRIVACY_URL = 'https://news-worker.wnwjdwns1.workers.dev/privacy';

// 크레딧(다른 뉴스 새로고침 차감) 활성화 — 정식 출시 시 true로 전환, 테스트는 무료
export const CREDITS_ENABLED = false;
