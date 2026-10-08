import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { closeOrderInGroups } from '@/lib/order-messages';

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

  if (order.closedInTelegram) {
    return NextResponse.json({ error: 'Поиск уже закрыт' }, { status: 400 });
  }

  await closeOrderInGroups(order.id);

  await prisma.order.update({
    where: { id: params.id },
    data: {
      closedInTelegram: true,
      closedInTelegramAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
