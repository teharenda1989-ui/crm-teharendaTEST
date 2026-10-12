import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const body = await req.json();
  const { name, phone, city, categories } = body;

  if (!name || !phone || !city) {
    return NextResponse.json(
      { error: 'Заполните имя, телефон и город' },
      { status: 400 },
    );
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json(
      { error: 'Выберите хотя бы одну рубрику' },
      { status: 400 },
    );
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Неверный телефон' }, { status: 400 });
  }

  for (const c of categories) {
    if (!VEHICLE_CATEGORIES.includes(c)) {
      return NextResponse.json(
        { error: `Рубрика "${c}" не найдена в справочнике` },
        { status: 400 },
      );
    }
  }

  // === Определяем partnerId в зависимости от роли ===
  let partnerId: string | null = null;

  if (scope.isSuperAdmin) {
    // Супер админ: ищем партнёра по городу из тела запроса
    const partnerByCity = await prisma.partner.findFirst({
      where: {
        isActive: true,
        OR: [{ city }, { cities: { has: city } }],
      },
      select: { id: true, name: true, city: true },
    });

    if (!partnerByCity) {
      return NextResponse.json(
        { error: `Партнёр для города "${city}" не найден. Сначала создайте филиал.` },
        { status: 404 },
      );
    }

    partnerId = partnerByCity.id;
  } else {
    // Партнёр: берём его partnerId и проверяем, что город входит в его список
    partnerId = scope.partnerId;

    if (!partnerId) {
      return NextResponse.json(
        { error: 'Не удалось определить партнёра' },
        { status: 400 },
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { city: true, cities: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Партнёр не найден' }, { status: 404 });
    }

    const allowedCities = new Set<string>();
    if (partner.city) allowedCities.add(partner.city);
    for (const c of partner.cities ?? []) allowedCities.add(c);

    if (!allowedCities.has(city)) {
      return NextResponse.json(
        { error: 'Этот город недоступен для вашего партнёра' },
        { status: 403 },
      );
    }
  }

  // ✅ Проверка дубля телефона у этого партнёра
  const existing = await prisma.owner.findFirst({
    where: {
      partnerId,
      phone: normalizedPhone,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Владелец с таким телефоном уже есть в базе этого филиала' },
      { status: 409 },
    );
  }

  // ✅ Создаём Owner + Vehicle
  const owner = await prisma.$transaction(async (tx) => {
    const newOwner = await tx.owner.create({
      data: {
        name: String(name).trim(),
        phone: normalizedPhone,
        city,
        partnerId,
        isRegistered: false,
        isOnShift: true,
        isActive: true,
      },
    });

    for (const cat of categories) {
      await tx.vehicle.create({
        data: { ownerId: newOwner.id, category: cat },
      });
    }

    return newOwner;
  });

  return NextResponse.json({ ok: true, owner });
}
