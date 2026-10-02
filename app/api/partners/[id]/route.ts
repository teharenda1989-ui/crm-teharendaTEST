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

  const partner = await prisma.partner.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.city !== undefined && { city: body.city || null }),
      ...(body.royaltyPercent !== undefined && {
        royaltyPercent: Number(body.royaltyPercent) || 0,
      }),
      ...(body.comment !== undefined && { comment: body.comment || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.maxBotToken !== undefined && {
        maxBotToken: body.maxBotToken || null,
      }),
      ...(body.cities !== undefined && {
        cities: Array.isArray(body.cities)
          ? body.cities
              .map((c: any) => String(c).trim())
              .filter((c: string) => c.length > 0)
          : [],
      }),
    },
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
