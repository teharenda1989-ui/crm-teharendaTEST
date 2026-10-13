import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

/**
 * Геокодирование адреса через Nominatim (OpenStreetMap).
 * Возвращает координаты или null, если не нашли.
 */
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?' +
      new URLSearchParams({
        q: address,
        format: 'json',
        limit: '1',
        'accept-language': 'ru',
      }).toString();

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Teharenda-CRM/1.0 (crm.teharenda.pro)',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

// ============= PATCH — сохранить изменения из формы =============
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const owner = await prisma.owner.findFirst({
    where: { id: params.id, ...scopeWhere(scope) },
  });

  if (!owner) {
    return NextResponse.json({ error: 'Владелец не найден' }, { status: 404 });
  }

  const body = await req.json();
  const {
    name,
    extraPhones,
    company,
    city,
    address,
    comment,
    notes,
    pricePerHour,
    minHours,
    additionalInfo,
    isActive,
  } = body;

  // Готовим данные для обновления
  const data: any = {};

  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (extraPhones !== undefined)
    data.extraPhones = extraPhones ? String(extraPhones).trim() : null;
  if (company !== undefined)
    data.company = company ? String(company).trim() : null;
  if (city !== undefined) data.city = city ? String(city).trim() : null;
  if (comment !== undefined)
    data.comment = comment ? String(comment).trim() : null;
  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;
  if (additionalInfo !== undefined)
    data.additionalInfo = additionalInfo
      ? String(additionalInfo).trim()
      : null;
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  // Числовые поля (могут прийти как null)
  if (pricePerHour !== undefined) {
    data.pricePerHour =
      pricePerHour === null || pricePerHour === ''
        ? null
        : Number(pricePerHour);
  }
  if (minHours !== undefined) {
    data.minHours =
      minHours === null || minHours === '' ? null : Number(minHours);
  }

  // Если адрес изменился — геокодируем
  const newAddress = address !== undefined ? String(address).trim() : null;
  if (address !== undefined) {
    data.address = newAddress || null;

    if (newAddress && newAddress !== owner.address) {
      const coords = await geocodeAddress(newAddress);
      if (coords) {
        data.lat = coords.lat;
        data.lng = coords.lng;
      }
    } else if (!newAddress) {
      // Адрес очистили — убираем координаты
      data.lat = null;
      data.lng = null;
    }
  }

  const updated = await prisma.owner.update({
    where: { id: owner.id },
    data,
  });

  return NextResponse.json({ ok: true, owner: updated });
}

// ============= DELETE — удалить владельца =============
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const owner = await prisma.owner.findFirst({
    where: { id: params.id, ...scopeWhere(scope) },
  });

  if (!owner) {
    return NextResponse.json({ error: 'Владелец не найден' }, { status: 404 });
  }

  const userId = owner.userId;

  await prisma.$transaction(async (tx) => {
    // Удаляем карточку владельца (каскадно удалится техника)
    await tx.owner.delete({ where: { id: owner.id } });

    // Если у владельца был связанный User — проверяем, не осталось ли карточек
    if (userId) {
      const remaining = await tx.owner.count({ where: { userId } });

      if (remaining === 0) {
        // Проверяем, что это действительно OWNER, а не PARTNER/SUPER_ADMIN
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role === 'OWNER') {
          await tx.user.delete({ where: { id: userId } });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
