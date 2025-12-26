// src/routes/index.js
import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';

const PAGES_ROOT = path.resolve('src/pages');
const OUT_FILE = path.resolve('src/routes/routes.generated.ts');

const downtime = 450;
let isGenerating = false;
let lastRun = 0;

/* 경로로 라우트 정보 생성 */
function createRouteInfo(file, oldMeta = {}) {
  const normalizedFile = file.replace(/\\/g, '/');
  const uri = normalizedFile.replace(/\.(jsx|tsx)$/, '');
  const url = uri.toLowerCase();
  const parts = uri.split('/').filter(Boolean);
  const key = parts.map((s) => s.toUpperCase()).join('_');
  const paths = parts.map((p) => '/' + p);
  const componentPath = '@pages' + uri;

  const { order, title, noLayout, hide } = oldMeta;
  const meta = {
    order: order ?? 999,
    ...(title ? { title } : {}),
    ...(noLayout ? { noLayout: noLayout } : {}),
    ...(hide ? { hide } : {}),
  };
  return { key, url, paths, componentPath, meta };
}

/*기존 ROUTES 문자열 파싱 */
function readOldRoutes(filePath = OUT_FILE) {
  if (!fs.existsSync(filePath)) return {};

  const text = fs.readFileSync(filePath, 'utf8');
  const body = text.match(/const\s+ROUTES\s*=\s*{([\s\S]*?)};/)?.[1];
  if (!body) return {};

  const result = {};
  // key 단위 블록 반복
  const keyBlockRegex = /(\w+):\s*{([^}]*?)}/g;
  let m;
  while ((m = keyBlockRegex.exec(body)) !== null) {
    const key = m[1];
    const props = m[2];

    const regex = /(\w+):\s*(.*?),/g;
    let n;
    const tmeta = {};
    while ((n = regex.exec(props)) !== null) {
      const k = n[1];
      let value = n[2].trim();

      // 문자열 양쪽 " 또는 ' 제거
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // 숫자 변환
      if (/^\d+$/.test(value)) {
        value = Number(value);
      }
      // boolean 변환
      else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }

      tmeta[k] = value;
    }

    // paths 배열 추출
    const pathsMatch = props.match(/paths\s*:\s*(\[[^\]]*\])/);
    const paths = pathsMatch ? JSON.parse(pathsMatch[1].replace(/'/g, '"')) : [];
    // url & componentPath
    const temp = paths.length ? paths.join('') : '';

    result[key] = createRouteInfo(temp, tmeta);
  }

  return result;
}

/* 메인 함수 */
export async function generateRoutes(changedFiles = null) {
  if (isGenerating) {
    console.warn('[generate-routes] Already running, skip this event');
    return;
  }
  isGenerating = true;
  const startTime = Date.now();

  const OLD_ROUTES = readOldRoutes(); // 현재 파일로부터 meta 유지
  if (Object.keys(OLD_ROUTES)?.length < 1) return;
  //console.log(OLD_ROUTES);
  let files;
  if (!changedFiles || changedFiles.length === 0) {
    // 전체 스캔
    files = await fg('**/*.{jsx,tsx}', { cwd: PAGES_ROOT });
  } else {
    files = changedFiles.map((f) => (path.isAbsolute(f) ? path.relative(PAGES_ROOT, f) : f));
  }

  const newRoutes = {};
  for (const file of files) {
    const oldMeta = OLD_ROUTES?.[createRouteInfo(file).key]?.meta || {};
    const base = createRouteInfo(`/${file}`, oldMeta);
    newRoutes[base.key] = base;
  }

  let mergedRoutes = { ...OLD_ROUTES };

  // --- partial update: 추가/수정/삭제 병합 ---
  for (const key of Object.keys(newRoutes)) {
    mergedRoutes[key] = newRoutes[key];
  }

  // --- 삭제 처리 (파일이 실제로 사라진 경우만)
  const allExistingFiles = await fg('**/*.{jsx,tsx}', { cwd: PAGES_ROOT });
  const allExistingKeys = new Set(allExistingFiles.map((f) => createRouteInfo(f).key));
  for (const key of Object.keys(mergedRoutes)) {
    if (!allExistingKeys.has(key)) delete mergedRoutes[key];
  }

  // --- order 정렬 ---
  const sortedKeys = Object.keys(mergedRoutes).sort(
    (a, b) => (mergedRoutes[a].meta?.order ?? 999) - (mergedRoutes[b].meta?.order ?? 999)
  );
  // --- 출력 ---
  const indent = '\n\t\t';
  const outContent = `// ⚙️ Auto-generated. Edit only the "meta" fields below.
import { lazy } from "react";
 
const ROUTES = {
${sortedKeys
  .map((k) => {
    const r = mergedRoutes[k];
    const metaStr = Object.entries(r.meta || {})
      .map(([key, val]) => (typeof val === 'string' ? `${key}: "${val}"` : `${key}: ${val}`))
      .join(',' + indent);
    return `\t${k}: {
    component: lazy(() => import("${r.componentPath}")),
    url: "${r.url}",
    paths: ${JSON.stringify(r.paths).replace(/,/g, ', ')},
    ${metaStr},
  }`;
  })
  .join(',\n')}
};
export default ROUTES;`;

  const isObjectsEqual = (a, b) =>
    a.length === b.length &&
    a.every((k, i) => {
      const k2 = b[i];
      return k === k2 && JSON.stringify(a[k]) === JSON.stringify(b[k2]);
    });

  // --- 기존과 동일하면 쓰기 생략 ---
  if (!isObjectsEqual(sortedKeys, Object.keys(OLD_ROUTES))) {
    await fs.promises.writeFile(OUT_FILE, outContent, 'utf-8');
    lastRun = Date.now();
    console.log(`🌟 ROUTES updated: ${OUT_FILE} done in ${Date.now() - startTime}ms`);
  } else {
    console.log('📴 ROUTES unchanged, skip writing.');
  }
  setTimeout(() => {
    isGenerating = false;
  }, downtime * 2);
}

/* watcher */
export function startRouteWatcher() {
  const watchers = [];
  const watchPaths = [PAGES_ROOT, OUT_FILE]; // 여러 경로를 감시
  console.log(`[generate-routes] Watching ${PAGES_ROOT}, OUT_FILE`);
  let timer;
  const changedFiles = new Set();

  const watchHandler = (eventType, filename, basePath) => {
    if (!filename) return;
    if (/\.swp$|~$/.test(filename)) return;
    const fullPath = path.join(basePath, filename);
    changedFiles.add(fullPath);
    clearTimeout(timer);

    timer = setTimeout(async () => {
      if (isGenerating) return;
      const files = Array.from(changedFiles);
      changedFiles.clear();
      try {
        await generateRoutes(files);
      } catch (err) {
        console.error('[generate-routes] Error regenerating:', err);
      }
    }, downtime);
  };

  watchPaths.forEach((targetPath) => {
    try {
      const watcher = fs.watch(
        targetPath,
        { recursive: fs.lstatSync(targetPath).isDirectory() },
        (eventType, filename) => watchHandler(eventType, filename, targetPath)
      );
      watchers.push(watcher);
    } catch (err) {
      console.error(`[generate-routes] Failed to watch ${targetPath}:`, err);
    }
  });
  return watchers;
}
