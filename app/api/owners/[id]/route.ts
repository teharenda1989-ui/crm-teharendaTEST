import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const owner = await prisma.owner.findFirst({
    where: { id: params.id, ...scopeWhere(scope) },
  });

  if (!owner) {
    return NextResponse.json({ error: 'Владелец не найден' }, { status: 404 });
  }

  const userId = owner.userId;

  await prisma.$transaction(async (tx) => {
    // Удаляем карточку владельца (каскадно удалится техника)
    await tx.owner.delete({ where: { id: owner.id } });

    // Если у владельца был связанный User — проверяем, не осталось ли карточек
    if (userId) {
      const remaining = await tx.owner.count({ where: { userId } });

      if (remaining === 0) {
        // Проверяем, что это действительно OWNER, а не PARTNER/SUPER_ADMIN
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role === 'OWNER') {
          await tx.user.delete({ where: { id: userId } });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
