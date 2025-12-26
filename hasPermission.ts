export type BasePermission = 'READ' | 'ADD' | 'MOD' | 'DEL' | 'CFM' | 'EXE';
export type PermissionScope = 'ALL' | 'ME' | 'RE' | 'USER' | 'ADMIN';
export type RoleValue = true | PermissionScope | undefined;
export type RoleMap = Record<BasePermission, RoleValue | undefined>;

export type PermissionSummary = Record<string, boolean | RoleValue>;

const SCOPES: Record<BasePermission, PermissionScope[]> = {
  READ: ['USER', 'ADMIN'],
  ADD: [],
  CFM: [],
  MOD: ['ALL', 'ME'],
  DEL: ['ALL', 'ME'],
  EXE: ['ALL', 'RE'],
};

/**
 * 모든 권한 조합을 boolean 값으로 반환
 * 예: MOD_ALL, MOD_ME, DEL_ALL, EXE_RE...
 */
export function hasPermission(roles: RoleMap): PermissionSummary {
  const result: PermissionSummary = {};
  for (const base of Object.keys(SCOPES) as BasePermission[]) {
    const value = roles[base];

    // base-level Permission (READ, ADD, CFM, MOD, DEL, EXE)
    result[base] = value || false;

    // 스코프 없는 권한이면 SKIP
    const scopes = SCOPES[base];
    if (scopes.length === 0) continue;

    // 스코프 있는 경우 ALL 처리 우선
    for (const scope of scopes) {
      const key = `${base}_${scope}`;

      if (!value) {
        result[key] = false;
      } else if (value === 'ALL') {
        result[key] = true; // ALL은 하위 스코프 모두 허용
      } else {
        result[key] = value === scope;
      }
    }
  }

  return result;
}
