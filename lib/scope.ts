import { getCurrentUser } from './auth';

export interface Scope {
  isSuperAdmin: boolean;
  partnerId: string | null;
}

export async function getScope(): Promise<Scope | null> {
  const session = await getCurrentUser();
  if (!session) return null;

  return {
    isSuperAdmin: session.role === 'SUPER_ADMIN',
    partnerId: session.partnerId,
  };
}

// Возвращает объект where для Prisma-запроса.
// Супер-админ видит ВСЕ данные (без фильтра).
// Партнёр — только свои (partnerId = его ID).
export function scopeWhere(scope: Scope): Record<string, unknown> {
  if (scope.isSuperAdmin) {
    return {}; // ← супер админ видит всех
  }
  return { partnerId: scope.partnerId };
}
