import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

// POST /api/mobile/profile/cities
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
  const { city } = body;

  if (!city || typeof city !== 'string') {
    return NextResponse.json({ error: 'Укажите город' }, { status: 400 });
  }

  const normalizedCity = city.trim();

  // Уже добавлен?
  const existing = await prisma.owner.findFirst({
    where: { userId: session.userId, city: normalizedCity },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Этот город уже добавлен' },
      { status: 409 },
    );
  }

  // Ищем партнёра по городу (учитывая массив cities)
  const partner = await prisma.partner.findFirst({
    where: {
      isActive: true,
      OR: [{ city: normalizedCity }, { cities: { has: normalizedCity } }],
    },
  });

  if (!partner) {
    return NextResponse.json(
      {
        error:
          'В этом городе пока нет нашего представительства. Оставьте свой город — мы свяжемся, как только откроемся в вашем регионе.',
        code: 'NO_PARTNER',
      },
      { status: 404 },
    );
  }

  // Проверяем, что профиль владельца существует
  const primaryOwner = await prisma.owner.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: 'asc' },
  });

  if (!primaryOwner) {
    return NextResponse.json(
      { error: 'Профиль владельца не найден' },
      { status: 400 },
    );
  }

  // ✅ ОБНОВЛЯЕМ существующего владельца, а не создаём нового
  // Новая БД имеет UNIQUE на userId — один пользователь = одна карточка владельца
  await prisma.owner.updateMany({
    where: { userId: session.userId },
    data: {
      city: normalizedCity,
      partnerId: partner.id,
      isRegistered: true,
    },
  });

  // Возвращаем обновлённую запись
  const updatedOwner = await prisma.owner.findFirst({
    where: { userId: session.userId },
    include: { vehicles: true },
  });

  return NextResponse.json({ ok: true, owner: updatedOwner });
}
