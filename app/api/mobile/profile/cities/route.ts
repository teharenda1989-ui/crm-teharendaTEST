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

  // Главная карточка — регистрационная (для копирования данных и техники)
  const primaryOwner = await prisma.owner.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: 'asc' },
    include: { vehicles: true },
  });

  if (!primaryOwner) {
    return NextResponse.json(
      { error: 'Профиль владельца не найден' },
      { status: 400 },
    );
  }

  const newOwner = await prisma.$transaction(async (tx) => {
    const owner = await tx.owner.create({
      data: {
        name: primaryOwner.name,
        phone: primaryOwner.phone,
        email: primaryOwner.email,
        company: primaryOwner.company,
        city: normalizedCity,
        partnerId: partner.id,
        userId: session.userId,
        isRegistered: true,
        isOnShift: primaryOwner.isOnShift,
        isActive: true,
      },
    });

    // Копируем технику
    if (primaryOwner.vehicles.length) {
      await tx.vehicle.createMany({
        data: primaryOwner.vehicles.map((v) => ({
          ownerId: owner.id,
          category: v.category,
          brand: v.brand,
          model: v.model,
          year: v.year,
          comment: v.comment,
        })),
      });
    }

    return owner;
  });

  return NextResponse.json({ ok: true, owner: newOwner });
}