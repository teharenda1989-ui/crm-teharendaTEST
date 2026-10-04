import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      owners: {
        orderBy: { createdAt: 'asc' },
        include: { vehicles: true },
      },
    },
  });

  if (!user || !user.owners.length) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  const primary = user.owners[0];

  // ✅ Суммируем статистику по всем карточкам
  const totalCompleted = user.owners.reduce(
    (sum, o) => sum + (o.completedOrders || 0),
    0,
  );

  // Рейтинг — берём средний по всем карточкам (или лучший)
  // Логика: если карточка новая и пустая (rating=4.5 по умолчанию),
  // она занижает средний. Берём средний по тем карточкам, где есть completedOrders > 0.
  const activeOwners = user.owners.filter((o) => o.completedOrders > 0);
  const avgRating = activeOwners.length > 0
    ? activeOwners.reduce((sum, o) => sum + o.rating, 0) / activeOwners.length
    : 4.5;

  const cities = user.owners
    .map((o) => ({
      ownerId: o.id,
      city: o.city,
    }))
    .filter((c) => !!c.city);

  // Уникальная техника по всем карточкам
  const allVehicles = user.owners.flatMap((o) => o.vehicles);
  const uniqueVehicles = Array.from(
    new Map(allVehicles.map((v) => [v.category, v])).values(),
  );

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    owner: {
      id: primary.id,
      name: primary.name,
      phone: primary.phone,
      company: primary.company,
      city: primary.city,
      rating: avgRating,
      completedOrders: totalCompleted,
      isOnShift: user.owners.some((o) => o.isOnShift),
      vehicles: uniqueVehicles.map((v) => ({
        id: v.id,
        category: v.category,
        comment: v.comment,
      })),
    },
    cities,
  });
}

export async function PATCH(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const body = await req.json();
  const data: any = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.company !== undefined)
    data.company = body.company ? String(body.company).trim() : null;

  if (body.phone !== undefined) {
    const p = String(body.phone).replace(/\D/g, '');
    if (p.length >= 10) data.phone = p;
  }

  if (Object.keys(data).length) {
    await prisma.owner.updateMany({
      where: { userId: session.userId },
      data,
    });
  }

  return NextResponse.json({ ok: true });
}
