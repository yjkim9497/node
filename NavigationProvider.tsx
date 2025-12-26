import React, { createContext, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ROUTES from '@routes/routes.generated';

// ---- Global 타입 선언 (TS 에러 해결) ----
declare global {
  interface Global {
    smartNavigate?: (path: string, replace?: boolean) => void;
  }
  // Node + Browser 환경 대응
  var smartNavigate: (path: string, replace?: boolean) => void | undefined;
}

// ---- Context 선언 ----
const NavigationContext = createContext<React.RefObject<any> | null>(null);

// ---- 내부 유틸 ----
const normalize = (path: string) => path.replace(/\/+$/, '');

const pathToRouteKey = (path: string) => {
  const segments = path.replace(/\/\d+/, '').split('/').filter(Boolean);
  return segments.map((seg) => seg.toUpperCase()).join('_');
};

// ---- Provider ----
export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<(to: string, replace?: boolean) => void>(() => {});

  const smartNavigate = (to: string, replace = false) => {
    const currentPath = normalize(location.pathname);
    let target = normalize(to);

    // full ROUTE key 여부 확인
    const routeKey = pathToRouteKey(target);
    const isFullPath = Object.prototype.hasOwnProperty.call(ROUTES, routeKey);

    // full path가 아니면 현재 path 기준 상대 이동 처리
    if (!isFullPath) {
      const segments = currentPath.replace(/\/\d+/, '').split('/').filter(Boolean);

      if (segments.length > 0) {
        segments[segments.length - 1] = target.replace(/^\//, '');
        target = '/' + segments.join('/');
      }
    }

    // 동일 경로 방지
    if (normalize(target) === currentPath) return;

    navigate(target, { replace });
  };

  // ref 업데이트
  navRef.current = smartNavigate;

  // ---- 전역 smartNavigate 등록 ----
  globalThis.smartNavigate = smartNavigate;

  return <NavigationContext.Provider value={navRef}>{children}</NavigationContext.Provider>;
};

// ---- Hook 방식 호출 (선택용) ----
export const useSmartNavigate = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useSmartNavigate must be used inside NavigationProvider');
  return ctx.current;
};

// ---- Global 방식 호출 ----
export const navigate = (...args: Parameters<NonNullable<typeof globalThis.smartNavigate>>) =>
  globalThis.smartNavigate?.(...args);
