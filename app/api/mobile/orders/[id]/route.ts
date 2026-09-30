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
        where: { ownerId: session.ownerId },
        orderBy: { takenAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  const myTake = order.takes[0];
  const isMine = !!myTake && myTake.status === 'TAKEN';
  const contactsShared = myTake?.clientContactsShared ?? false;

  // Базовая инфа — всем
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
  };

  // Диспетчер и телефон — только если заявка моя (взял её)
  if (isMine) {
    response.dispatcher = order.dispatcher;
    response.dispatcherPhone = order.dispatcherPhone;
  }

  // Клиент — только если диспетчер поделился
  if (contactsShared) {
    response.clientName = order.clientName;
    response.clientPhone = order.clientPhone;
  }

  return NextResponse.json(response);
}
