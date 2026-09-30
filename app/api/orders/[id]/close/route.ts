import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import {
  editTelegramMessage,
  buildClosedOrderMessage,
} from '@/lib/telegram';
import {
  editMaxMessage,
  buildClosedOrderMessageMax,
} from '@/lib/max';
import { getMaxTokenForPartner } from '@/lib/max-token';

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
    include: { logs: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  if (order.closedInTelegram) {
    return NextResponse.json(
      { error: 'Поиск уже закрыт' },
      { status: 400 },
    );
  }

  // Тексты для закрытия
  const closedTextTg = buildClosedOrderMessage({
    category: order.category,
    city: order.city,
    when: order.when || '',
    description: order.description,
    dispatcher: order.dispatcher,
    dispatcherPhone: order.dispatcherPhone,
  });

  const closedTextMax = buildClosedOrderMessageMax({
    category: order.category,
    city: order.city,
    when: order.when || '',
    description: order.description,
    dispatcher: order.dispatcher,
    dispatcherPhone: order.dispatcherPhone,
  });

  // Уникальные пары chatId+messageId
  const seen = new Set<string>();
  const targets: {
    chatId: string;
    messageId: string;
    channel: string;
    partnerId: string | null;
  }[] = [];

  for (const log of order.logs) {
    if (!log.chatId || !log.messageId) continue;
    const key = `${log.chatId}:${log.messageId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Ищем группу, чтобы узнать её partnerId
    const group = await prisma.telegramGroup.findFirst({
      where: { chatId: log.chatId, messenger: log.channel },
      select: { partnerId: true },
    });

    targets.push({
      chatId: log.chatId,
      messageId: log.messageId,
      channel: log.channel,
      partnerId: group?.partnerId || null,
    });
  }

  for (const t of targets) {
    if (t.channel === 'max') {
      const token = await getMaxTokenForPartner(t.partnerId);
      if (!token) continue;

      const res = await editMaxMessage(
        t.chatId,
        t.messageId,
        closedTextMax,
        token,
      );
      if (res.error && res.error.includes('Too Many Requests')) break;
    } else {
      const res = await editTelegramMessage(
        t.chatId,
        t.messageId,
        closedTextTg,
      );
      if (res.error && res.error.includes('Too Many Requests')) break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  await prisma.order.update({
    where: { id: params.id },
    data: {
      closedInTelegram: true,
      closedInTelegramAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
