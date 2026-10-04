import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

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

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: params.id,
      owner: { userId: session.userId },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  }

  // ✅ Удаляем во всех карточках по (category, comment)
  await prisma.vehicle.deleteMany({
    where: {
      category: vehicle.category,
      comment: vehicle.comment,
      owner: { userId: session.userId },
    },
  });

  return NextResponse.json({ ok: true });
}
