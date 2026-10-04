import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const owners = await prisma.owner.findMany({
    where: { userId: session.userId },
    include: { vehicles: true },
  });

  // Собираем уникальные категории по всем карточкам
  const allVehicles = owners.flatMap((o) => o.vehicles);
  const uniqueVehicles = Array.from(
    new Map(allVehicles.map((v) => [v.category, v])).values(),
  );

  return NextResponse.json(uniqueVehicles);
}

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

  if (!VEHICLE_CATEGORIES.includes(cat)) {
    return NextResponse.json(
      { error: 'Такой рубрики нет в списке. Выберите из предложенных.' },
      { status: 400 },
    );
  }

  const cmt = comment ? String(comment).trim() : null;

  const owners = await prisma.owner.findMany({
    where: { userId: session.userId },
  });

  if (!owners.length) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  // ✅ Проверка: если уже есть такая категория хотя бы в одной карточке
  const existing = await prisma.vehicle.findFirst({
    where: {
      owner: { userId: session.userId },
      category: cat,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Эта рубрика уже добавлена' },
      { status: 409 },
    );
  }

  // ✅ Добавляем во ВСЕ карточки этого User
  await prisma.$transaction(
    owners.map((o) =>
      prisma.vehicle.create({
        data: { ownerId: o.id, category: cat, comment: cmt },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
