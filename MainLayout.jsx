import { Outlet, useLocation } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';
import NavMenu from './NavMenu';
import Tabs from './Tabs';
import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@store/authStore';
import ROUTES from '@routes/routes.generated';
import { navigate } from '@routes/NavigationProvider';

export default function MainLayout({ tree }) {
  const { pathname } = useLocation();

  const { token } = useAuthStore();

  // tree 재귀 정렬 배열변환
  const sortTree = (node = {}) =>
    Object.entries(node).reduce(
      (acc, [, obj]) => (obj?.url ? [...acc, { ...obj, children: obj.children ? sortTree(obj.children) : [] }] : acc),
      []
    );

  const [data] = useState(() => sortTree(tree));

  function getItemsByDepth(data = {}) {
    const titles = [];
    const tabs = [];
    const keys = pathname?.replace(/\/\d+/, '').split('/')?.filter(Boolean);

    let target = tree;
    keys.forEach((key, idx) => {
      const current = target?.[key];
      if (!current) return;
      if (current?.title) titles.push(current.title);
      const arr = Object.values(current?.children)?.filter((e) => e.url);
      if (arr?.length > 0 && idx < keys?.length - 2) tabs.push(arr);
      target = current?.children;
    });

    return { titles: titles?.filter(Boolean), tabs };
  }

  // 테스트
  const { titles, tabs } = useMemo(() => getItemsByDepth(data) || {}, [pathname]);

  //로그아웃이 되면, 로그인 페이지로 이동.
  useEffect(() => {
    if (!token) navigate(ROUTES.SIGNIN.url);
  }, [token]);

  return (
    <div className="h-screen flex flex-col">
      <NavMenu data={data} titles={titles} />
      <div
        style={{ height: 'calc(100vh - 64px)' }} // NavMenu 높이 64px 기준
      >
        <div className="bg-gray-50 rounded-lg shadow p-2">
          <Breadcrumb titles={titles} />
          {tabs.map((el, i) => (
            <Tabs key={JSON.stringify(el)} items={el} title={titles?.[i + 1]} />
          ))}
          <div className="overflow-auto min-h-[400px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
