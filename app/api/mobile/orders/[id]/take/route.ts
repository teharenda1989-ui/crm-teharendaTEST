import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

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

  // Уже взял кто-то другой?
  const alreadyTaken = order.takes.some((t) => t.status === 'TAKEN');
  if (alreadyTaken) {
    return NextResponse.json(
      { error: 'Заявку уже взял другой исполнитель' },
      { status: 409 },
    );
  }

  // Находим Owner-запись этого User с подходящим городом
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

  const take = await prisma.$transaction(async (tx) => {
    const t = await tx.orderTake.create({
      data: {
        orderId: order.id,
        ownerId: owner.id,
        status: 'TAKEN',
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

    return t;
  });

  return NextResponse.json({ ok: true, take });
}