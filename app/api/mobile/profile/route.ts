import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { owner: { include: { vehicles: true } } },
  });

  if (!user?.owner) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    owner: user.owner,
  });
}

export async function PATCH(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const body = await req.json();
  const data: any = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.company !== undefined)
    data.company = body.company ? String(body.company).trim() : null;
  if (body.phone !== undefined) {
    const p = String(body.phone).replace(/\D/g, '');
    if (p.length >= 10) data.phone = p;
  }

  if (Object.keys(data).length) {
    await prisma.owner.update({
      where: { id: session.ownerId },
      data,
    });
  }

  return NextResponse.json({ ok: true });
}