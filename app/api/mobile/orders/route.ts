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

  const owners = await prisma.owner.findMany({
    where: { userId: session.userId, isActive: true },
    include: { vehicles: true },
  });

  if (!owners.length) {
    return NextResponse.json({ orders: [] });
  }

  const onShiftOwners = owners.filter((o) => o.isOnShift);
  if (!onShiftOwners.length) {
    return NextResponse.json({ orders: [] });
  }

  const cities = Array.from(
    new Set(onShiftOwners.map((o) => o.city).filter(Boolean)),
  ) as string[];

  const categories = Array.from(
    new Set(onShiftOwners.flatMap((o) => o.vehicles.map((v) => v.category))),
  );

  if (!cities.length || !categories.length) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: {
      status: 'ACTIVE',
      publishedInApp: true,
      closedInApp: false,
      city: { in: cities },
      category: { in: categories },
      takes: {
        none: {
          status: { in: ['TAKEN', 'COMPLETED_PENDING'] },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      category: true,
      city: true,
      when: true,
      description: true,
      startAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ orders });
}
