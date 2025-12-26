// src/api/communityApi.ts
import { http } from '@api/axios';
import commonApi from '@api/commonApi';

/** ---------------- Types ---------------- */
export type Id = number | string;

export interface BasePost {
  id: Id;
  title?: string;
  contents?: string;
  writer?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
}

export interface ListParams {
  pageNo?: number;
  pageRowCount?: number;
  keyword?: string;
  sort?: string;
  [k: string]: any;
}

/** ---------------- URL building ---------------- */
const COMMUNITY_ROOT = '/community' as const;

/**
 * 정적 커뮤니티 타입 (경로가 /community/{type} 인 것들)
 * - incident / notice / faq / board / doc / bot
 * - 동적 게시판(xboard)은 별도 처리
 */
const COMMUNITY_TYPES = ['incident', 'notice', 'faq', 'board', 'doc', 'bot'] as const;
export type CommunityType = (typeof COMMUNITY_TYPES)[number];

/** XBoard 의 categoryType (ex: 'NOTICE', 'FAQ', 'QNA' 등) */
export type XBoardCategoryType = string;

const baseOf = (type: CommunityType) => `${COMMUNITY_ROOT}/${type}`;

const pathsOf = (type: CommunityType): string[] => [COMMUNITY_ROOT, `/${type}`];

const getCtx = (type: CommunityType) => {
  const base = baseOf(type); // "/community/notice"
  const paths = pathsOf(type); // ['/community','/notice']
  return { type, base, paths };
};

/** ---------------- Generic CRUD ---------------- */
export async function list<T = BasePost>(type: CommunityType, params?: ListParams) {
  const { paths } = getCtx(type);
  return commonApi.list<T[]>({ paths, params }); // GET /list
}

export async function detail<T = BasePost>(type: CommunityType, id: Id) {
  const { paths } = getCtx(type);
  return commonApi.detail<T>({ paths, id }); // GET /:id
}

export async function add<TId = number>(type: CommunityType, payload: Record<string, any> | FormData) {
  const { paths } = getCtx(type);
  return commonApi.add<TId>({ paths, params: payload as any }); // POST /add
}

export async function modify(type: CommunityType, payload: Record<string, any> | (FormData & { id: Id })) {
  if (payload?.id == null) throw new Error('[communityApi] modify payload.id is required');
  const { paths } = getCtx(type);
  return commonApi.modify<boolean>({
    paths,
    params: { ...(payload as any), id: payload.id },
  }); // POST /modify/{id}
}

export async function remove(type: CommunityType, ids: Id[]) {
  const { paths } = getCtx(type);
  const payload = { ids: ids.map(Number), categoryType: type };
  return commonApi.remove<boolean>({ paths, ids: payload.ids }); // POST /delete
}

/** ---------------- Bulk actions (정적 섹션용) ---------------- */
export async function publicAll(type: CommunityType, ids: Id[]) {
  const { base } = getCtx(type);
  const payload = { ids: ids.map(Number), categoryType: type };
  const { data } = await http.post<boolean>(`${base}/bulknormal`, payload);
  return data;
}

export async function privateAll(type: CommunityType, ids: Id[]) {
  const { base } = getCtx(type);
  const payload = { ids: ids.map(Number), categoryType: type };
  const { data } = await http.post<boolean>(`${base}/bulkprivate`, payload);
  return data;
}

/** ---------------- Section factory (정적 타입별 섹션) ---------------- */
function makeSection<T extends BasePost = BasePost>(type: CommunityType) {
  const { base, paths } = getCtx(type);
  return {
    /** 필요 시 URL을 직접 써야 할 때 */
    url: (suffix = '') => (suffix ? `${base}/${suffix}` : base),

    list: (params?: ListParams) => commonApi.list<T[]>({ paths, params }),
    detail: (id: Id) => commonApi.detail<T>({ paths, id }),
    add: (payload: Record<string, any> | FormData) => commonApi.add<number>({ paths, params: payload as any }),
    modify: (payload: Record<string, any> | (FormData & { id: Id })) =>
      commonApi.modify<boolean>({
        paths,
        params: { ...(payload as any), id: payload.id },
      }),
    remove: (ids: Id[]) => commonApi.remove<boolean>({ paths, ids }),

    // 공통 bulk 버전 사용 (정적 타입 기준)
    publicAll: (ids: Array<Id>) => commonApi.publicAll({ paths, ids }),
    privateAll: (ids: Array<Id>) => commonApi.privateAll({ paths, ids }),
  };
}

/* -------------------------------------------------------------- */
/*  11.7 동적 게시판 XBoard - /community/xboard/{categoryType}   */
/* -------------------------------------------------------------- */

const XBOARD_ROOT = '/community/xboard' as const;
const xboardPathsOf = (categoryType: XBoardCategoryType): string[] => [XBOARD_ROOT, `/${categoryType}`];

function makeXboardSection<T extends BasePost = BasePost>() {
  return {
    /**
     * XBoard base URL
     *  ex) url('NOTICE') => "/community/xboard/NOTICE"
     *      url('NOTICE', 'list') => "/community/xboard/NOTICE/list"
     */
    url: (categoryType: XBoardCategoryType, suffix = '') =>
      suffix ? `${XBOARD_ROOT}/${categoryType}/${suffix}` : `${XBOARD_ROOT}/${categoryType}`,

    /** 목록 — GET /community/xboard/{categoryType}/list */
    list: (categoryType: XBoardCategoryType, params?: ListParams) =>
      commonApi.list<T[]>({
        paths: xboardPathsOf(categoryType) as any,
        params,
      }),

    /** 상세 — GET /community/xboard/{categoryType}/{id} */
    detail: (categoryType: XBoardCategoryType, id: Id) =>
      commonApi.detail<T>({
        paths: xboardPathsOf(categoryType) as any,
        id,
      }),

    /** 등록 — POST /community/xboard/{categoryType}/add */
    add: (categoryType: XBoardCategoryType, payload: Record<string, any> | FormData) =>
      commonApi.add<number>({
        paths: xboardPathsOf(categoryType) as any,
        params: payload as any,
      }),

    /** 수정 — POST /community/xboard/{categoryType}/modify/{id} */
    modify: (categoryType: XBoardCategoryType, payload: Record<string, any> | (FormData & { id: Id })) =>
      commonApi.modify<boolean>({
        paths: xboardPathsOf(categoryType) as any,
        params: { ...(payload as any), id: payload.id },
      }),

    /** 삭제 — POST /community/xboard/{categoryType}/delete */
    remove: (categoryType: XBoardCategoryType, ids: Id[]) =>
      commonApi.remove<boolean>({
        paths: xboardPathsOf(categoryType) as any,
        ids: ids.map(Number),
      }),

    /** 일괄 공개 — ex) POST /community/xboard/{categoryType}/bulknormal */
    publicAll: (categoryType: XBoardCategoryType, ids: Array<Id>) =>
      commonApi.publicAll({
        paths: xboardPathsOf(categoryType) as any,
        ids,
      }),

    /** 일괄 비공개 — ex) POST /community/xboard/{categoryType}/bulkprivate */
    privateAll: (categoryType: XBoardCategoryType, ids: Array<Id>) =>
      commonApi.privateAll({
        paths: xboardPathsOf(categoryType) as any,
        ids,
      }),
  };
}

/** ---------------- Grouped API (권장) ---------------- */
export const communityApi = {
  incident: makeSection('incident'),
  notice: makeSection('notice'),
  faq: makeSection('faq'),
  board: makeSection('board'),
  doc: makeSection('doc'),
  bot: makeSection('bot'),

  /** 11.7 동적 게시판 XBoard
   *  사용 예:
   *   communityApi.xboard.list('NOTICE', params)
   *   communityApi.xboard.add('FAQ', formData)
   */
  xboard: makeXboardSection(),
};

/** ---------------- Backward-compatible sugar ---------------- */
// 장애관리
export const getErrorBoards = (params?: ListParams) => list('incident', params);
export const getErrorBoard = (id: Id) => detail('incident', id);
export const addErrorBoard = (body: any) => add('incident', body);
export const modifyErrorBoard = (params: any & { id: Id }) => modify('incident', params);
export const deleteErrorBoard = (ids: Id[]) => remove('incident', ids);

// 공지
export const getNotices = (params?: ListParams) => list('notice', params);
export const getNotice = (id: Id) => detail('notice', id);
export const addNotice = (body: any) => add('notice', body);
export const modifyNotice = (params: any & { id: Id }) => modify('notice', params);
export const deleteNotice = (ids: Id[]) => remove('notice', ids);

// FAQ
export const getFaqs = (params?: ListParams) => list('faq', params);
export const getFaq = (id: Id) => detail('faq', id);
export const addFaq = (body: any) => add('faq', body);
export const modifyFaq = (params: any & { id: Id }) => modify('faq', params);
export const deleteFaq = (ids: Id[]) => remove('faq', ids);

// 일반 게시판
export const getBoards = (params?: ListParams) => list('board', params);
export const getBoard = (id: Id) => detail('board', id);
export const addBoard = (body: any) => add('board', body);
export const modifyBoard = (params: any & { id: Id }) => modify('board', params);
export const deleteBoard = (ids: Id[]) => remove('board', ids);

// 자료실
export const getResources = (params?: ListParams) => list('doc', params);
export const getResource = (id: Id) => detail('doc', id);
export const addResource = (body: any) => add('doc', body);
export const modifyResource = (params: any & { id: Id }) => modify('doc', params);
export const deleteResource = (ids: Id[]) => remove('doc', ids);

// 챗봇
export const getBots = (params?: ListParams) => list('bot', params);
export const getBot = (id: Id) => detail('bot', id);
export const addBot = (body: any) => add('bot', body);
export const modifyBot = (params: any & { id: Id }) => modify('bot', params);
export const deleteBot = (ids: Id[]) => remove('bot', ids);
