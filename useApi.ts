// { useFetch, useMutate }
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import type { AxiosProgressEvent } from 'axios';

/** 빈값 판별 함수  */
function isEmptyValue(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  //if (typeof value === 'object') return Object.values(value).some(isEmptyValue);
  return false;
}

/**
 * vars 값에 따라 자동 enabled / disabled
 */
export function useFetch<TData = unknown, TVariables extends Record<string, any> = any, TError = unknown>(
  fn: (vars: TVariables) => Promise<TData>,
  vars: TVariables,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
): UseQueryResult<TData, TError> {
  const key = fn.name ?? 'anonymousQueryFn';

  // enabled 여부
  const userEnabled = Object.prototype.hasOwnProperty?.call(options ?? {}, 'enabled');

  // vars 유효 검사
  const hasInvalidVars = Object.values(vars ?? {}).some(isEmptyValue);
  const mergedOptions = {
    ...options,
    enabled: userEnabled ? options?.enabled : !hasInvalidVars,
  };

  return useQuery<TData, TError>({
    queryKey: [key, vars],
    queryFn: () => fn(vars),
    ...mergedOptions,
  });
}

/** ---------------- 유틸 ---------------- */
function matchPaths(qKey: unknown, targetPaths: string[]) {
  if (!Array.isArray(qKey)) return false;
  const vars = qKey[1];
  const paths = vars?.paths;
  const match = paths?.join('')?.startsWith(targetPaths?.slice(0, targetPaths.length - 1)?.join(''));
  return paths && Array.isArray(paths) ? match : false;
}

function isFileLike(v: any): boolean {
  if (!v) return false;
  if (typeof File !== 'undefined' && v instanceof File) return true;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return true;
  if (typeof FileList !== 'undefined' && v instanceof FileList) return true;
  return false;
}

function containsFile(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (isFileLike(obj)) return true;
  if (Array.isArray(obj)) return obj.some(containsFile);
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (isFileLike(v)) return true;
      if (typeof v === 'object' && containsFile(v)) return true;
    }
  }
  return false;
}

function appendFormData(fd: FormData, key: string, value: any) {
  if (value === undefined || value === null) return;
  if (isFileLike(value)) {
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
      Array.from(value).forEach((file) => fd.append(`${key}[]`, file));
    } else if (Array.isArray(value) && value.every(isFileLike)) {
      value.forEach((file) => fd.append(`${key}[]`, file));
    } else {
      fd.append(key, value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => {
      const k = `${key}[]`;
      if (typeof v === 'object' && !isFileLike(v)) {
        fd.append(k, JSON.stringify(v));
      } else {
        appendFormData(fd, k, v);
      }
    });
    return;
  }
  if (typeof value === 'object') {
    for (const subKey in value) {
      if (!Object.prototype.hasOwnProperty.call(value, subKey)) continue;
      appendFormData(fd, `${key}[${subKey}]`, value[subKey]);
    }
    return;
  }
  fd.append(key, String(value));
}

export function buildFormData(payload: any): FormData {
  const fd = new FormData();
  if (!payload || typeof payload !== 'object') return fd;
  for (const key in payload) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    appendFormData(fd, key, payload[key]);
  }
  return fd;
}

/** ---------------- 타입 ---------------- */
interface UseMutateOptions<TData, TVariables> {
  autoFormData?: boolean;
  defaultVars?: TVariables;
  invalidateOnSettled?: boolean;
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
  onMutate?: (variables: TVariables, qc: ReturnType<typeof useQueryClient>) => void | Promise<any>;
}

/**  실행 후 같은 depth 모든 cache invalidate
 *  - mAsync(): defaultVars 사용, mAsync(vars): 새 변수
 */
export function useMutate<TData = unknown, TVariables extends Record<string, any> = any>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  options: UseMutateOptions<TData, TVariables> = {}
): UseMutationResult<TData, unknown, TVariables, unknown> & {
  mAsync: (vars?: TVariables) => Promise<TData>;
  m: (vars?: TVariables) => void;
} {
  const qc = useQueryClient();
  const { autoFormData = true, defaultVars, invalidateOnSettled, ...rest } = options;

  const fnName = mutationFn.name?.trim() || 'anonymousMutation';
  const queryKey = [fnName];

  const mutation = useMutation<TData, unknown, TVariables>({
    mutationKey: queryKey,
    mutationFn: async (vars: TVariables) => {
      const payload = autoFormData && containsFile(vars) ? (buildFormData(vars) as unknown as TVariables) : vars;
      const result = await mutationFn(payload);

      const paths = vars?.paths;
      const invalidate = invalidateOnSettled ?? (Array.isArray(paths) && paths.length > 0);

      if (invalidate) {
        if (paths) {
          // paths 기반 자동 invalidate
          await Promise.all(
            qc
              .getQueryCache()
              .getAll()
              .map((q) => {
                if (!matchPaths(q.queryKey, paths)) return null;
                return qc.invalidateQueries({ queryKey: q.queryKey });
              })
          );
        } else {
          // 기존 invalidate
          await qc.invalidateQueries({ queryKey });
        }
      }
      return result;
    },

    // react-query 최신 스타일에서는 onMutate만 여전히 유효
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      if (rest.onMutate) return rest.onMutate(vars, qc);
    },
  });

  return {
    ...mutation,
    mAsync: (vars?: TVariables) => mutation.mutateAsync((vars ?? defaultVars) as TVariables),
    m: (vars?: TVariables) => mutation.mutate((vars ?? defaultVars) as TVariables),
  };
}
