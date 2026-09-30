import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.id, ownerId: session.ownerId },
  });

  if (!vehicle) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id: vehicle.id } });

  return NextResponse.json({ ok: true });
}