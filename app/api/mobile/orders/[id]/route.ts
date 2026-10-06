import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function GET(
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
    include: {
      takes: {
        where: {
          owner: { userId: session.userId },
        },
        orderBy: { takenAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  // ✅ Ищем последнюю отмену этим User по этой заявке
  const canceledTake = await prisma.orderTake.findFirst({
    where: {
      orderId: order.id,
      status: 'CANCELED',
      owner: { userId: session.userId },
    },
    orderBy: { canceledAt: 'desc' },
  });

  const myTake = order.takes[0];
  const isMine = myTake?.status === 'TAKEN';
  const isPending = myTake?.status === 'COMPLETED_PENDING';
  const contactsShared = myTake?.clientContactsShared ?? false;

  const response: any = {
    id: order.id,
    category: order.category,
    city: order.city,
    when: order.when,
    description: order.description,
    startAt: order.startAt,
    status: order.status,
    myTakeStatus: myTake?.status ?? null,
    contactsShared,
    canceledAt: canceledTake?.canceledAt ?? null,
  };

  if (isMine || isPending) {
    response.dispatcher = order.dispatcher;
    response.dispatcherPhone = order.dispatcherPhone;
  }

  if (contactsShared) {
    response.clientName = order.clientName;
    response.clientPhone = order.clientPhone;
  }

  return NextResponse.json(response);
}
