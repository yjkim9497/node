/* eslint-disable no-undef */
import { useEffect, useRef } from 'react';

type MatrixRef = HTMLDivElement | null;

export function useTruncateMatrixObserver() {
  const matrix = useRef<MatrixRef[][]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const ensureMatrixSize = (row: number, col: number) => {
    if (!matrix.current[row]) matrix.current[row] = [];
    if (!matrix.current[row][col]) matrix.current[row][col] = null;
  };

  const updateNode = (el: HTMLDivElement) => {
    const truncate = el.scrollWidth > el.clientWidth;
    const hasTitle = el.title && el.dataset.autoTitle !== 'true';

    el.style.textDecoration = hasTitle ? 'underline' : 'none';
    if (hasTitle) return;

    if (truncate && !el.title) {
      el.dataset.autoTitle = 'true';
      el.title = el.textContent ?? '';
    } else if (!truncate && el.dataset.autoTitle === 'true') {
      delete el.dataset.autoTitle;
      el.removeAttribute('title');
    }
  };

  // ResizeObserver 초기화
  useEffect(() => {
    resizeObserver.current = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        entries.forEach((entry) => updateNode(entry.target as HTMLDivElement));
      });
    });

    return () => resizeObserver.current?.disconnect();
  }, []);

  // 초기 mount 시 전체 노드 검사
  useEffect(() => {
    requestAnimationFrame(() => {
      matrix.current.forEach((row) => {
        row.forEach((el) => el && updateNode(el));
      });
    });
  });

  // register 함수
  const register = (row: number, col: number) => (el: HTMLDivElement | null) => {
    ensureMatrixSize(row, col);
    matrix.current[row][col] = el;

    if (el && resizeObserver.current) {
      resizeObserver.current.observe(el);
    }
  };

  return { register };
}
