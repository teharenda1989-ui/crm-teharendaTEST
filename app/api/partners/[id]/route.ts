import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const partner = await prisma.partner.findUnique({
    where: { id: params.id },
    include: { users: true },
  });

  if (!partner) {
    return NextResponse.json({ error: 'Партнёр не найден' }, { status: 404 });
  }

  return NextResponse.json(partner);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  const body = await req.json();

  const data: any = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.royaltyPercent !== undefined)
    data.royaltyPercent = Number(body.royaltyPercent) || 0;
  if (body.comment !== undefined) data.comment = body.comment || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.maxBotToken !== undefined)
    data.maxBotToken = body.maxBotToken || null;

  // Если cities передали — обрабатываем массив
  if (body.cities !== undefined) {
    const cities: string[] = Array.isArray(body.cities)
      ? Array.from(
          new Set(
            body.cities
              .map((c: any) => String(c).trim())
              .filter((c: string) => c.length > 0),
          ),
        )
      : [];

    data.cities = cities;
    // Основной city = первый город в списке
    data.city = cities[0] || null;
  }

  const partner = await prisma.partner.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(partner);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  await prisma.user.deleteMany({ where: { partnerId: params.id } });
  await prisma.partner.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
