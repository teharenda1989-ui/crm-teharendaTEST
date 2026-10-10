import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { reopenOrderInGroups } from '@/lib/order-messages';

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
    include: { groups: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  const hasGroups = order.groups.length > 0;

  if (hasGroups && order.closedInTelegram) {
    await reopenOrderInGroups(order.id);
  }

  await prisma.order.update({
    where: { id: params.id },
    data: {
      ...(hasGroups && { closedInTelegram: false, closedInTelegramAt: null }),
      ...(order.publishedInApp && { closedInApp: false }),
    },
  });

  return NextResponse.json({ ok: true });
}
