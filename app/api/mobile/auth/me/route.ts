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
  const cities = user.owners
    .map((o) => o.city)
    .filter((c): c is string => !!c);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    owner: {
      id: primary.id,
      name: primary.name,
      phone: primary.phone,
      company: primary.company,
      city: primary.city,
      rating: primary.rating,
      completedOrders: primary.completedOrders,
      isOnShift: primary.isOnShift,
      vehicles: primary.vehicles.map((v) => ({
        id: v.id,
        category: v.category,
        comment: v.comment,
      })),
    },
    cities,
  });
}
