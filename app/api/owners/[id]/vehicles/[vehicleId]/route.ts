import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; vehicleId: string } },
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

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, ownerId: owner.id },
  });
  if (!vehicle) {
    return NextResponse.json({ error: 'Техника не найдена' }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id: vehicle.id } });

  return NextResponse.json({ ok: true });
}