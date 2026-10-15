import { NextRequest, NextResponse } from 'next/server';
import { getScope } from '@/lib/scope';

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope || !scope.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
  }

  const { password } = await req.json();
  const correct = process.env.TOKEN_VIEW_PASSWORD;

  if (!correct) {
    return NextResponse.json(
      { ok: false, error: 'Пароль не настроен в переменных окружения Timeweb' },
      { status: 500 },
    );
  }

  if (password === correct) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Неверный пароль' }, { status: 401 });
}
