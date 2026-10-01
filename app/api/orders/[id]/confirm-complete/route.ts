import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: { id: params.id, ...scopeWhere(scope) },
  });
  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  const take = await prisma.orderTake.findFirst({
    where: { orderId: order.id, status: 'COMPLETED_PENDING' },
    include: { owner: true },
  });

  if (!take) {
    return NextResponse.json(
      { error: 'Нет заявки, ожидающей подтверждения' },
      { status: 400 },
    );
  }

  const newRating = Math.min(5.0, take.owner.rating + 0.05);

  await prisma.$transaction(async (tx) => {
    await tx.orderTake.update({
      where: { id: take.id },
      data: { status: 'DONE' },
    });

    await tx.owner.update({
      where: { id: take.ownerId },
      data: {
        rating: newRating,
        completedOrders: take.owner.completedOrders + 1,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CLOSED',
        result: 'SUCCESS',
        closedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        type: 'ORDER_CONFIRMED',
        orderId: order.id,
        ownerId: take.ownerId,
        message: `Заявка ${order.category} подтверждена. +0.05 к рейтингу`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}