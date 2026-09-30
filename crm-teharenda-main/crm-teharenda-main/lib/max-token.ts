import { prisma } from './prisma';

/**
 * Возвращает MAX-токен для партнёра.
 * Если у партнёра свой токен — используем его.
 * Иначе (или для супер-админа) — общий из переменной.
 */
export async function getMaxTokenForPartner(
  partnerId: string | null,
): Promise<string | null> {
  if (partnerId) {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { maxBotToken: true },
    });
    if (partner?.maxBotToken) {
      return partner.maxBotToken;
    }
  }

  return process.env.MAX_BOT_TOKEN || null;
}