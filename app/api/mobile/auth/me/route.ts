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

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      owners: {
        orderBy: { createdAt: 'asc' },
        include: { vehicles: true },
      },
    },
  });

  if (!user || !user.owners.length) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  const primary = user.owners[0];

  const totalCompleted = user.owners.reduce(
    (sum, o) => sum + (o.completedOrders || 0),
    0,
  );

  const activeOwners = user.owners.filter((o) => o.completedOrders > 0);
  const avgRating = activeOwners.length > 0
    ? activeOwners.reduce((sum, o) => sum + o.rating, 0) / activeOwners.length
    : 4.5;

  const cities = user.owners
    .map((o) => o.city)
    .filter((c): c is string => !!c);

  const allVehicles = user.owners.flatMap((o) => o.vehicles);
  const uniqueVehicles = Array.from(
    new Map(allVehicles.map((v) => [v.category, v])).values(),
  );

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    owner: {
      id: primary.id,
      name: primary.name,
      phone: primary.phone,
      company: primary.company,
      city: primary.city,
      rating: avgRating,
      completedOrders: totalCompleted,
      isOnShift: user.owners.some((o) => o.isOnShift),
      vehicles: uniqueVehicles.map((v) => ({
        id: v.id,
        category: v.category,
        comment: v.comment,
      })),
    },
    cities,
  });
}
