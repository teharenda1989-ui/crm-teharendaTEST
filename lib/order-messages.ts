import { prisma } from './prisma';
import {
  editTelegramMessage,
  buildOrderMessage,
  buildClosedOrderMessage,
} from './telegram';
import {
  editMaxMessage,
  buildOrderMessageMax,
  buildClosedOrderMessageMax,
} from './max';
import { getMaxTokenForPartner } from './max-token';

type Mode = 'close' | 'reopen';

/**
 * Редактирует сообщения заявки во всех группах TG/MAX.
 * mode = 'close'  → редактирует на "🔒 ЗАЯВКА ЗАКРЫТА"
 * mode = 'reopen' → редактирует на "🚜 Новая заявка"
 */
async function editOrderMessages(orderId: string, mode: Mode) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { logs: true },
  });

  if (!order) return;

  const payload = {
    category: order.category,
    city: order.city,
    when: order.when || '',
    description: order.description,
    dispatcher: order.dispatcher,
    dispatcherPhone: order.dispatcherPhone,
  };

  const textTg =
    mode === 'close'
      ? buildClosedOrderMessage(payload)
      : buildOrderMessage(payload);

  const textMax =
    mode === 'close'
      ? buildClosedOrderMessageMax(payload)
      : buildOrderMessageMax(payload);

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

  if (!targets.length) return;

  for (const t of targets) {
    if (t.channel === 'max') {
      const token = await getMaxTokenForPartner(t.partnerId);
      if (!token) continue;
      const res = await editMaxMessage(t.chatId, t.messageId, textMax, token);
      if (res.error && res.error.includes('Too Many Requests')) break;
    } else {
      const res = await editTelegramMessage(t.chatId, t.messageId, textTg);
      if (res.error && res.error.includes('Too Many Requests')) break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Закрыть заявку в группах (редактирует сообщения на «🔒 ЗАКРЫТА») */
export async function closeOrderInGroups(orderId: string) {
  await editOrderMessages(orderId, 'close');
}

/** Открыть заявку заново в группах (редактирует на «🚜 Новая заявка») */
export async function reopenOrderInGroups(orderId: string) {
  await editOrderMessages(orderId, 'reopen');
}
