import LoadingSpinner from '@components/ui/LoadingSpinner';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import GlobalModal from '@components/modal/GlobalModal';
import { ErrorBoundary } from '@components/system/ErrorBoundary';
import ROUTES from '@routes/routes.generated';
import { Suspense, useEffect, useMemo, useState } from 'react';
import SignIn from '@pages/SignIn';
import { useAuthStore } from '@store/authStore';
import { NavigationProvider } from '@routes/NavigationProvider';
import { hasPermission } from '@utils/hasPermission';

/* ---- 권한 트리 생성 ---- */
function buildRoleTree(roleList) {
  const root = {};
  const regex = /_(READ|ADD|MOD|DEL|CFM|EXE)[\w\d_]*$/i;

  for (const role of roleList) {
    const clean = role.replace(/^ROLE_/, '');
    const match = clean.match(regex);

    const matched = match ? match[0] : '';
    const [key = 'use', value = true] = matched.split('_').filter(Boolean);

    const name = match ? clean.replace(match[0], '') : clean;
    const parts = name.split('_')?.filter(Boolean);

    let cursor = root;
    parts.forEach((p, idx) => {
      if (!cursor[p]) cursor[p] = {};
      if (idx === parts.length - 1) cursor[p][key] = value;
      cursor = cursor[p];
    });
  }
  return root;
}

/* ---- 문자열 부분 포함(약어) 검사 (subsequence) ---- */
function isSubsequence(abbrev, word) {
  const a = abbrev.toLowerCase();
  const w = word.toLowerCase();
  let i = 0,
    j = 0;
  while (i < a.length && j < w.length) {
    if (a[i] === w[j]) i++;
    j++;
  }
  return i === a.length;
}

/* ----- 권한 확인 ---- */
function matchRole(pathname, role) {
  const keys = pathname.split('/').filter(Boolean);
  const safeDepth = Math.max(1, keys.length - 1);
  const pathParts = keys.slice(0, safeDepth);

  //1depth 예외처리
  if (keys.length === 1) return true;
  let cursor = role;

  for (let i = 0; i < pathParts.length; i++) {
    const search = Object.keys(cursor).find((rk) => isSubsequence(rk, pathParts[i]));
    if (!search) return false;
    else if (cursor[search]?.READ) return true; // 상위 권한 처리

    cursor = cursor[search];
  }
  return true;
}

/* ---- Route 구조 + roleTree 기반 권한 매칭 ---- */
function buildTree(routesObj, roleTree) {
  const root = {};

  Object.values(routesObj).forEach((route) => {
    const allowed = matchRole(route.url, roleTree);
    const keys = route.url.split('/').filter(Boolean);

    let cursor = root;
    let url = '';

    let roleCursor = roleTree;
    let f = 0;

    keys.forEach((key, idx) => {
      url += '/' + key; //누적값
      const pow = 10 ** (3 - 1 - idx);
      if (idx < Math.max(1, keys.length - 1)) {
        const found = Object.keys(roleCursor).find((rk) => isSubsequence(rk, key));
        if (found) {
          roleCursor = roleCursor[found];
          f = f + 1;
        }
      }

      // route tree 생성
      if (!cursor[key]) {
        cursor[key] = {
          key,
          title: route.title?.split('_')?.filter(Boolean)?.[idx] ?? '',
          ...(allowed ? { url: route.url } : {}),
          order: Math.floor(route.order / pow) * pow,
          ...(f ? { roles: roleCursor } : {}),
          children: {},
        };
      }
      // 마지막이면 해당 route 메타 연결
      if (idx === keys.length - 1) {
        cursor[key].meta = route;
      }
      cursor = cursor[key].children;
    });
  });

  return root;
}

/* ---- Route 생성 ---- */
function renderRouteNodes(nodeMap = {}, tree) {
  return Object.values(nodeMap)?.map((node) => {
    const { key, url, children, meta, roles } = node;
    const childNodes = renderRouteNodes(children, tree);
    const needId = /(?:detail|edit)$/i.test(key);
    // 만약 해당 노드에 실제 컴포넌트(meta)가 있으면 leaf 또는 중간+leaf
    if (url) {
      if (meta && !meta.noLayout) {
        const Component = meta.component;
        const permissions = hasPermission(roles ?? {});
        return (
          <Route
            key={url}
            path={needId ? `${key}/:id` : key}
            element={
              <Suspense>
                <Component {...permissions} paths={meta.paths} tree={tree} />
              </Suspense>
            }
          >
            {childNodes}
          </Route>
        );
      }

      // 해당 노드 자체는 컴포넌트 없고 자식만 있는 경우 (그룹)
      return (
        <Route key={url} path={key}>
          {childNodes}
        </Route>
      );
    }
  });
}

// ------------------ APP ENTRY ------------------

export default function App() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const roles = useAuthStore((s) => s.roles);

  // 권한 기반으로 필터링된 tree 생성
  const roleTree = useMemo(() => buildRoleTree(roles), [roles]);
  const tree = useMemo(() => buildTree(ROUTES, roleTree), [ROUTES, roleTree]);
  const filteredRoutes = useMemo(() => renderRouteNodes(tree, tree), [tree]);

  // load pages
  useEffect(() => {
    const pages = import.meta.glob('./pages/**/*.{jsx,tsx}');
    const loaders = Object.values(pages);
    const total = loaders.length;
    let loaded = 0;
    let frameId = null;
    let timer = null;

    const updateProgress = () => {
      console.log(Math.round((loaded / total) * 100));
      frameId = null;
    };

    const promises = loaders.map((fn) =>
      fn().finally(() => {
        loaded += 1;
        if (!frameId) {
          frameId = window.requestAnimationFrame(updateProgress);
        }
      })
    );

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <NavigationProvider>
          <GlobalModal />
          {Boolean(isFetching || isMutating) && <LoadingSpinner />}
          <Routes>
            <Route key="/signIn" path="/signIn" element={<SignIn />} />
            <Route element={<MainLayout tree={tree} />}>{filteredRoutes}</Route>
            {/* 권한 없는 루트 접근 시 login or 403 페이지 리디렉션 */}
            <Route path="*" element={<Navigate to="/signIn" replace />} />
          </Routes>
        </NavigationProvider>
      </Router>
    </ErrorBoundary>
  );
}
