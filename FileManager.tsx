import React, { useState, useMemo, useCallback, forwardRef, useImperativeHandle, FC, useRef } from 'react';
import { fetchFiles, uploader, deleteFiles, download } from '@api/commonFileApi';
import { useFetch, useMutate } from '@hooks/useApi';
import { validateFilesBlacklist } from '@utils/fileFilters';
import type { FileMeta } from './formProps';

export interface FileManagerState {
  queued: File[]; // 실제 File 객체 배열 (브라우저 메모리)
  deleted: number[]; // 서버에서 삭제 예약된 fileSequence 리스트
}

export interface FileManagerHandle {
  collect: (reset?: boolean) => FileManagerState;
  fileUpload: () => Promise<Record<string, any>>;
  getState: () => FileManagerState; // 현재 상태 복사본 반환
  reload: () => void;
}

const cacheOptions = {
  retry: 1,
  staleTime: Infinity,
  cacheTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
};

const Chip: FC<{
  label: string;
  onClick?: () => void;
  deletable?: boolean;
  onDelete?: () => void;
  className?: string;
}> = ({ label, onClick, deletable, onDelete, className }) => (
  <span
    className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-sm ${
      className || 'bg-gray-100 hover:bg-gray-200'
    }`}
    title={label}
  >
    <button type="button" className="truncate max-w-[12rem]" onClick={onClick}>
      {label}
    </button>
    {deletable && (
      <button type="button" className="ml-1 rounded-full p-0.5 hover:bg-gray-200" onClick={onDelete} aria-label="삭제">
        ✕
      </button>
    )}
  </span>
);

export interface FileAttachHandle {
  fileUpload: () => Promise<Record<string, any>>;
}

interface Props {
  init?: Record<string, any>;
  form: any;
  setForm: React.Dispatch<any>;
  name?: string;
  label?: string;
  tableId: string;
  columnId: string;
  accept?: string;
  mode?: 'view' | 'append' | 'All';
  multiple?: boolean;
  className?: string;
}

const genInstanceId = () => `fm-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const FileManager = forwardRef<FileAttachHandle, Props>(
  (
    {
      init,
      name = 'fileGroupSequence',
      form,
      setForm,
      tableId,
      columnId,
      accept = '*/*',
      mode = 'view',
      multiple = true,
      className,
    },
    ref
  ) => {
    const instanceId = useRef(genInstanceId()).current;
    const inputId = `${instanceId}-input`;

    // internal state
    const [queued, setQueued] = useState<File[]>(init?.queued ?? []);
    const [deleted, setDeleted] = useState<Set<number>>(new Set(init?.deleted ?? []));
    const { data: rows = [], refetch } = useFetch(fetchFiles, { [name]: form?.[name] }, cacheOptions);

    const { mAsync: upload } = useMutate(uploader, { autoFormData: false });
    const { mAsync: deletes } = useMutate(deleteFiles);

    // key 생성 함수
    const keyOf = useCallback((f: File) => `${f.name}|${f.size}|${f.lastModified}`, []);

    // 서버 파일 목록 → 빠른 비교용 Set
    //const serverKeys = useMemo(() => new Set(rows.map((r) => `${r.fileName}|${r.fileSize}`)), [rows]);

    // 서버 목록 중 유지될 항목 표시
    const visible = useMemo(() => rows.filter((f) => !deleted.has(f.fileSequence)), [rows, deleted]);

    // visible 기준으로 중복 비교용 Set 생성
    const visibleKeys = useMemo(() => new Set(visible.map((v) => `${v.fileName}|${v.fileSize}`)), [visible]);

    // 새 파일 추가
    const addQueued = useCallback(
      (files: File[]) => {
        const next = files
          .filter((f) => !visibleKeys.has(`${f.name}|${f.size}`))
          .filter((f) => !queued.some((q) => keyOf(q) === keyOf(f)));
        if (next.length) setQueued((prev) => [...prev, ...next]);
      },
      [queued, visibleKeys, keyOf]
    );

    // 파일 선택 이벤트(검증 포함)
    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.currentTarget.files ?? []);
      if (!picked.length) return;
      const { valid, invalid } = validateFilesBlacklist(picked, { maxBytes: 10 * 1024 * 1024 });
      if (valid.length) addQueued(valid);
      if (invalid.length) {
        throw new Error(
          invalid.map(({ file, reason, details }) => `${file.name} - ${reason} \n ${details}`).join('\n')
        );
      }
    };

    // 삭제 토글
    const toggleDelete = useCallback((seq: number) => {
      setDeleted((prev) => {
        const n = new Set(prev);
        n.has(seq) ? n.delete(seq) : n.add(seq);
        return n;
      });
    }, []);

    //다운로드
    const handleDownload = useCallback(async (meta: FileMeta) => {
      const { blob, filename } = await download(meta.fileSequence);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || meta.fileName || `download-${meta.fileSequence}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    }, []);

    // collect current state
    const collect = useCallback(
      (reset = false): FileManagerState => {
        const state: FileManagerState = {
          queued: [...queued],
          deleted: Array.from(deleted),
        };
        if (reset) {
          setQueued([]);
          setDeleted(new Set());
        }
        return state;
      },
      [queued, deleted]
    );

    // 파일 업로드 처리
    const fileUpload = useCallback(async () => {
      const deletedSeqs = Array.from(deleted);
      const serverSeqs = rows.map((r) => r.fileSequence);
      let group = form?.[name] ?? null;

      // 1️⃣ 서버 파일 삭제
      if (group && deletedSeqs.length > 0) {
        await deletes({ fileGroupSequence: group, ids: deletedSeqs });
      }

      // 2️⃣ 신규 파일 업로드
      if (queued.length > 0) {
        const res = await upload({
          files: queued,
          tableId,
          columnId,
          fileGroupSequence: group,
          keepFileSeqs: serverSeqs.filter((seq) => !deletedSeqs.includes(seq)),
        });
        if (res?.fileGroupSequence) {
          group = res.fileGroupSequence;
          setForm((prev: any) => ({ ...prev, [name]: group }));
        }
      }

      // 3️⃣ 상태 초기화 및 갱신
      if (queued.length > 0 || deletedSeqs.length > 0) {
        setQueued([]);
        setDeleted(new Set());
        refetch();
      }

      return { [name]: group };
    }, [queued, deleted, rows, upload, deletes, refetch]);

    // 외부에서 fileUpload 호출 가능하도록 ref 노출
    useImperativeHandle(
      ref,
      () => ({
        collect,
        fileUpload,
        getState: collect,
      }),
      [collect, fileUpload]
    );

    return (
      <div className={className}>
        <div className="flex items-center self-baseline gap-3">
          {mode !== 'view' && (
            <div className="w-24 self-baseline">
              <input
                id={`${inputId}`}
                type="file"
                data-label="파일 선택"
                accept={accept}
                multiple={multiple}
                onChange={(e) => {
                  onPick(e);
                  if (e.target.value) {
                    e.target.value = '';
                  }
                }}
                style={{ display: 'none' }}
              />
              <label
                htmlFor={`${inputId}`}
                className="block w-full text-sm text-center mr-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
                style={{ width: 'max-content' }}
              >
                파일 선택
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {visible.map((f) => (
              <Chip
                key={`srv-${f.fileSequence}`}
                label={`📎 ${f.fileName}`}
                deletable={mode === 'All'}
                onClick={() => handleDownload(f)}
                onDelete={() => toggleDelete(f.fileSequence)}
              />
            ))}
            {queued.map((f, i) => (
              <Chip
                key={`q-${i}`}
                label={`⏳ ${f.name}`}
                deletable
                onDelete={() => setQueued((q) => q.filter((_, idx) => idx !== i))}
                className="bg-blue-50"
              />
            ))}
            {!visible.length && !queued.length && <div className="text-gray-400">첨부된 파일이 없습니다.</div>}
          </div>
        </div>
      </div>
    );
  }
);

export default FileManager;
