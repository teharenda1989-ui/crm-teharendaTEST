import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const body = await req.json();
  const isOnShift = !!body.isOnShift;

  // Обновляем у ВСЕХ карточек Owner этого User
  await prisma.owner.updateMany({
    where: { userId: session.userId },
    data: { isOnShift },
  });

  return NextResponse.json({ ok: true, isOnShift });
}
