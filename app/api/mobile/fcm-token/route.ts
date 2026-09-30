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
  const { fcmToken } = body;

  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'Укажите fcmToken' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { fcmToken },
  });

  return NextResponse.json({ ok: true });
}