import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createMobileToken } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Укажите email и пароль' },
      { status: 400 },
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { owners: { orderBy: { createdAt: 'asc' } } },
  });

  if (!user || user.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'Неверный email или пароль' },
      { status: 401 },
    );
  }

  if (!user.isActive) {
    return NextResponse.json({ error: 'Аккаунт отключён' }, { status: 403 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: 'Неверный email или пароль' },
      { status: 401 },
    );
  }

  if (!user.owners.length) {
    return NextResponse.json(
      { error: 'Профиль владельца не найден' },
      { status: 400 },
    );
  }

  const primaryOwner = user.owners[0];

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await createMobileToken({
    userId: user.id,
    ownerId: primaryOwner.id,
    email: user.email,
    role: 'OWNER',
  });

  return NextResponse.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name },
    owner: {
      id: primaryOwner.id,
      city: primaryOwner.city,
      rating: primaryOwner.rating,
    },
  });
}
