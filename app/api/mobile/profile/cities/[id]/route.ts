import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

// DELETE /api/mobile/profile/cities/[id]
// id — это Owner.id (карточка города)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const owner = await prisma.owner.findFirst({
    where: { id: params.id, userId: session.userId },
  });

  if (!owner) {
    return NextResponse.json(
      { error: 'Запись не найдена' },
      { status: 404 },
    );
  }

  // Нельзя удалить последнюю карточку
  const count = await prisma.owner.count({
    where: { userId: session.userId },
  });

  if (count <= 1) {
    return NextResponse.json(
      { error: 'Нельзя удалить последнюю запись' },
      { status: 400 },
    );
  }

  await prisma.owner.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}