import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function POST(
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
  const { category, comment } = body;

  if (!category || typeof category !== 'string') {
    return NextResponse.json({ error: 'Укажите рубрику' }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: owner.id,
      category: category.trim(),
      comment: comment?.trim() || null,
    },
  });

  return NextResponse.json(vehicle);
}

export async function GET(
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

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: owner.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(vehicles);
}