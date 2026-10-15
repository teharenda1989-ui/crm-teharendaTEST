import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Webhook для MAX. Сюда приходят события от бота.
 * Логируем всё — chat_id виден в логах Timeweb.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Печатаем всё событие одной строкой — легко искать в логах
    console.log('[MAX] EVENT:', JSON.stringify(body));

    const chatId = body?.message?.recipient?.chat_id;
    const chatType = body?.message?.recipient?.chat_type;
    const updateType = body?.update_type;

    if (chatId) {
      console.log(`[MAX] 🎯 chat_id=${chatId} chat_type=${chatType} update=${updateType}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[MAX] parse error:', e.message);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}