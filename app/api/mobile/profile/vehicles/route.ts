import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

// GET — берём технику из главной карточки
export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const primary = await prisma.owner.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: 'asc' },
    include: { vehicles: true },
  });

  return NextResponse.json(primary?.vehicles ?? []);
}

// POST — добавляем технику во ВСЕ карточки
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
  const { category, comment } = body;

  if (!category || typeof category !== 'string') {
    return NextResponse.json({ error: 'Укажите рубрику' }, { status: 400 });
  }

  const cat = category.trim();
  const cmt = comment ? String(comment).trim() : null;

  const owners = await prisma.owner.findMany({
    where: { userId: session.userId },
  });

  if (!owners.length) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  // Добавляем во все карточки
  for (const o of owners) {
    await prisma.vehicle.create({
      data: { ownerId: o.id, category: cat, comment: cmt },
    });
  }

  return NextResponse.json({ ok: true });
}
