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

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: session.ownerId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(vehicles);
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

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: session.ownerId,
      category: category.trim(),
      comment: comment?.trim() || null,
    },
  });

  return NextResponse.json(vehicle);
}