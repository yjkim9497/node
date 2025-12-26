// src/api/commonFileApi.ts
import { http } from '@api/axios';
import type { FileMeta, UploadResult } from '@components/form/formProps';
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';

export type Id = number | string;
export interface FetchFilesParams {
  fileGroupSequence?: Id | null;
}
export interface DeleteFilesParams {
  fileGroupSequence: Id;   // 로깅/일관성 용
  ids: Id[];
}

const BASE = '/commonfile' as const;
const url = {
  groupFiles: (groupSeq: Id) => `${BASE}/group/${groupSeq}`,
  upload: `${BASE}/upload`,
  upsert: (groupSeq: Id) => `${BASE}/upsert/${groupSeq}`,
  deleteFile: (fileSeq: Id) => `${BASE}/file/${fileSeq}`,
  deleteGroup: (groupSeq: Id) => `${BASE}/group/${groupSeq}`,
  download: (fileSeq: Id) => `${BASE}/download/${fileSeq}`,
};

/* -------------------------------------------
 * helpers: mapping & filename
 * ------------------------------------------*/
function mapToFileMeta(row: any): FileMeta {
  return {
    fileSequence: Number(row.fileSequence ?? row.fileSeq ?? row.fileId ?? row.id),
    fileGroupSequence: Number(row.fileGroupSequence ?? row.groupSeq ?? row.groupId),
    fileName: String(row.fileName ?? row.originName ?? row.name),
    fileSize: Number(row.fileSize ?? row.size ?? 0),
    filePath: String(row.filePath ?? row.path ?? ''),
  };
}

function mapToUploadResult(payload: any): UploadResult {
  const group =
    payload?.fileGroupSequence ??
    payload?.groupSeq ??
    payload?.groupId ??
    payload?.data?.fileGroupSequence ??
    payload?.data?.groupSeq;

  const files =
    payload?.files ??
    payload?.data?.files ??
    payload?.data ??
    [];

  return {
    fileGroupSequence: Number(group ?? 0),
    files: Array.isArray(files) ? files.map(mapToFileMeta) : [],
  };
}

function parseFilename(disposition?: string | null) {
  if (!disposition) return;
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) return decodeURIComponent(utf8[1]);
  const ascii =
    /filename\s*=\s*"([^"]+)"/i.exec(disposition) ||
    /filename\s*=\s*([^;]+)/i.exec(disposition);
  return ascii?.[1]?.trim();
}

/* -------------------------------------------
 * API
 * ------------------------------------------*/

/** List files for a file group */
export async function fetchFiles({fileGroupSequence}: FetchFilesParams): Promise<FileMeta[]> {
  if (fileGroupSequence == null) return [];
  const res = await http.get(url.groupFiles(fileGroupSequence));
  const data = (res as any)?.data ?? res;
  const rows = Array.isArray(data) ? data : (data?.files ?? data?.data ?? []);
  return (rows as any[]).map(mapToFileMeta);
}

/** Build upload or upsert URL by group existence */
function getUploadUrl(fileGroupSequence?: Id | null): string {
  if (fileGroupSequence != null && Number(fileGroupSequence) !== 0) {
    return url.upsert(fileGroupSequence);
  }
  return url.upload;
}

/** Upload files (new group or upsert existing) */
export async function uploader(
  vars: { 
    files: File[]; 
    tableId: string; 
    columnId: string; 
    fileGroupSequence?: Id | null;
    keepFileSeqs?: Array<number | string>;
    onUploadProgress?: (e: AxiosProgressEvent) => void;
}): Promise<UploadResult> {
  const { files, tableId, columnId, fileGroupSequence, keepFileSeqs, onUploadProgress } = vars;

  const form = new FormData();
  for (const f of files) form.append('files', f);
  form.append('tableId', tableId);
  form.append('columnId', columnId);

  let target = getUploadUrl(fileGroupSequence);
  const isUpsert = fileGroupSequence != null && Number(fileGroupSequence) !== 0;
  
  if (isUpsert) {
    const list = Array.isArray(keepFileSeqs) ? keepFileSeqs : [];
    const qs = list.map(s => `keepFileSeqs=${encodeURIComponent(String(s))}`).join('&');
    if (qs.length) target += (target.includes('?') ? '&' : '?') + qs;
  }

  const config: AxiosRequestConfig = { onUploadProgress };

  const res = await http.post(target, form, config);
  const data = (res as any)?.data ?? res;
  return mapToUploadResult(data);
}

/** Delete multiple files within a group (client-side batch) */
export async function deleteFiles({fileGroupSequence, ids}: DeleteFilesParams): Promise<void> {
  // groupSeq는 시그니처 일관성/감사 로깅용으로 받되, 실제 호출은 단건 삭제를 병렬로
  await Promise.all(ids.map((id) => http.delete(url.deleteFile(id))));
}

/** Delete single file by fileSequence */
export async function deleteFile(meta: FileMeta): Promise<void> {
  await http.delete(url.deleteFile(meta.fileSequence));
}

/** Delete whole group by fileGroupSequence */
export async function deleteGroup(fileGroupSequence: Id): Promise<void> {
  await http.delete(url.deleteGroup(fileGroupSequence));
}

/** Download a file; returns Blob + filename (if provided) */
export async function download(fileSequence: Id): Promise<{ blob: Blob; filename?: string }> {
  const res = await http.get(url.download(fileSequence), {
    responseType: 'blob',
    headers: { Accept: '*/*' },
  });
  const headers = (res as any).headers ?? {};
  const filename = parseFilename(headers['content-disposition']);
  const blob = ((res as any).data ?? res) as Blob;
  return { blob, filename };
}

const commonFileApi = {
  fetchFiles,
  uploader,
  deleteFiles,
  deleteFile,
  deleteGroup,
  download,
};

export default commonFileApi;
