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
    where: { orderId: order.id, status: 'TAKEN' },
  });

  if (!take) {
    return NextResponse.json(
      { error: 'Заявку пока никто не взял' },
      { status: 400 },
    );
  }

  if (take.clientContactsShared) {
    return NextResponse.json(
      { error: 'Контакты уже отправлены' },
      { status: 400 },
    );
  }

  await prisma.orderTake.update({
    where: { id: take.id },
    data: {
      clientContactsShared: true,
      clientContactsSharedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}