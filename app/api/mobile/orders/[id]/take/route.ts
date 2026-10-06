import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

const CANCEL_COOLDOWN_MINUTES = 15;

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

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { takes: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  if (order.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'Заявка больше не активна' },
      { status: 400 },
    );
  }

  const alreadyTaken = order.takes.some((t) => t.status === 'TAKEN');
  if (alreadyTaken) {
    return NextResponse.json(
      { error: 'Заявку уже взял другой исполнитель' },
      { status: 409 },
    );
  }

  // Находим Owner-карточку с подходящим городом (для записи)
  const owner = await prisma.owner.findFirst({
    where: {
      userId: session.userId,
      city: order.city ?? undefined,
    },
  });

  if (!owner) {
    return NextResponse.json(
      { error: 'Вы не можете взять эту заявку' },
      { status: 403 },
    );
  }

  // ✅ Ищем отмену ЛЮБОЙ карточкой этого User (не только абаканской)
  const myCanceled = order.takes
    .filter((t) => t.status === 'CANCELED' && t.canceledAt)
    .filter(async () => true); // заглушка, ниже делаем через отдельный запрос

  // Запрашиваем отмены со связанной карточкой Owner по userId
  const canceledTake = await prisma.orderTake.findFirst({
    where: {
      orderId: order.id,
      status: 'CANCELED',
      owner: { userId: session.userId },
    },
    orderBy: { canceledAt: 'desc' },
  });

  if (canceledTake?.canceledAt) {
    const minutesPassed =
      (Date.now() - new Date(canceledTake.canceledAt).getTime()) / 1000 / 60;

    if (minutesPassed < CANCEL_COOLDOWN_MINUTES) {
      const minutesLeft = Math.ceil(CANCEL_COOLDOWN_MINUTES - minutesPassed);
      return NextResponse.json(
        {
          error: `Вы отказались от этой заявки ранее. Повторно взять можно через ${minutesLeft} мин.`,
          cooldownMinutesLeft: minutesLeft,
        },
        { status: 429 },
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const take = await tx.orderTake.create({
      data: {
        orderId: order.id,
        ownerId: owner.id,
        status: 'TAKEN',
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        closedInTelegram: true,
        closedInTelegramAt: new Date(),
        assigneeName: owner.name,
        assigneePhone: owner.phone,
      },
    });

    await tx.notification.create({
      data: {
        type: 'ORDER_TAKEN',
        orderId: order.id,
        ownerId: owner.id,
        message: `${owner.name} взял ${order.category}`,
      },
    });

    return take;
  });

  return NextResponse.json({ ok: true, take: result });
}
