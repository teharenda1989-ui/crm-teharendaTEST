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

  const ownerIds = (
    await prisma.owner.findMany({
      where: { userId: session.userId },
      select: { id: true },
    })
  ).map((o) => o.id);

  const take = await prisma.orderTake.findFirst({
    where: {
      orderId: params.id,
      ownerId: { in: ownerIds },
      status: 'TAKEN',
    },
    include: { order: true, owner: true },
  });

  if (!take) {
    return NextResponse.json(
      { error: 'Заявка не в работе' },
      { status: 404 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderTake.update({
      where: { id: take.id },
      data: { status: 'COMPLETED_PENDING' },
    });

    await tx.notification.create({
      data: {
        type: 'ORDER_COMPLETED_PENDING',
        orderId: take.orderId,
        ownerId: take.ownerId,
        message: `${take.owner.name} отметил ${take.order.category} как выполненную — подтвердите`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}