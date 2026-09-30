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
    include: { owner: { include: { vehicles: true } } },
  });

  if (!user || !user.owner) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    owner: {
      id: user.owner.id,
      name: user.owner.name,
      phone: user.owner.phone,
      company: user.owner.company,
      city: user.owner.city,
      rating: user.owner.rating,
      completedOrders: user.owner.completedOrders,
      isOnShift: user.owner.isOnShift,
      vehicles: user.owner.vehicles.map((v) => ({
        id: v.id,
        category: v.category,
        comment: v.comment,
      })),
    },
  });
}