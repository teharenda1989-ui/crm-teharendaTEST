import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // Временный секрет — потом удалим файл целиком
  if (secret !== 'SEED_ME_12345') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Офис';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL или ADMIN_PASSWORD не заданы в переменных' },
      { status: 400 },
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      name,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      name,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true,
    message: 'Админ создан/обновлён',
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}