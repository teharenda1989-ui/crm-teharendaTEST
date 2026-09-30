import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

function calcRatingImpact(hoursLeft: number): number {
  if (hoursLeft >= 24) return -0.02;
  if (hoursLeft >= 2) return -0.15;
  return -0.3;
}

export async function POST(
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

  const body = await req.json();
  const { reason } = body;

  if (!reason || typeof reason !== 'string') {
    return NextResponse.json(
      { error: 'Укажите причину отказа' },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  // Находим все Owner-записи этого User
  const ownerIds = (
    await prisma.owner.findMany({
      where: { userId: session.userId },
      select: { id: true },
    })
  ).map((o) => o.id);

  const take = await prisma.orderTake.findFirst({
    where: {
      orderId: order.id,
      ownerId: { in: ownerIds },
      status: 'TAKEN',
    },
    include: { owner: true },
  });

  if (!take) {
    return NextResponse.json(
      { error: 'Вы не брали эту заявку' },
      { status: 404 },
    );
  }

  // Расчёт штрафа
  let hoursLeft = 999;
  if (order.startAt) {
    hoursLeft =
      (new Date(order.startAt).getTime() - Date.now()) / 1000 / 3600;
  }
  const ratingImpact = calcRatingImpact(hoursLeft);

  const newRating = Math.max(
    1.0,
    Math.min(5.0, take.owner.rating + ratingImpact),
  );

  await prisma.$transaction(async (tx) => {
    await tx.orderTake.update({
      where: { id: take.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelReason: reason,
        ratingImpact,
      },
    });

    await tx.owner.update({
      where: { id: take.ownerId },
      data: { rating: newRating },
    });

    await tx.notification.create({
      data: {
        type: 'ORDER_CANCELED',
        orderId: order.id,
        ownerId: take.ownerId,
        message: `${take.owner.name} отказался от ${order.category}, причина: ${reason}`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}