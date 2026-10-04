import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createMobileToken } from '@/lib/mobile-auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, phone, company } = body;

  if (!email || !password || !name || !phone) {
    return NextResponse.json(
      { error: 'Заполните все обязательные поля' },
      { status: 400 },
    );
  }

  if (String(password).length < 6) {
    return NextResponse.json(
      { error: 'Пароль не менее 6 символов' },
      { status: 400 },
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedPhone = String(phone).replace(/\D/g, '');

  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Неверный телефон' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  // Проверяем, есть ли User с таким email
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { owners: true },
  });

  // === Сценарий 1: User есть, но это PARTNER/SUPER_ADMIN — блокируем ===
  if (existingUser && existingUser.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'Email уже используется. Обратитесь в поддержку.' },
      { status: 409 },
    );
  }

  // === Сценарий 2: User есть, это OWNER, но у него остались карточки ===
  if (existingUser && existingUser.owners.length > 0) {
    return NextResponse.json(
      { error: 'Email уже зарегистрирован' },
      { status: 409 },
    );
  }

  // === Сценарий 3: User есть, OWNER, карточек нет — разрешаем перерегистрацию ===
  if (existingUser && existingUser.owners.length === 0) {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          name: String(name).trim(),
          isActive: true,
          fcmToken: null, // сбрасываем старый токен устройства
        },
      });

      const owner = await tx.owner.create({
        data: {
          name: String(name).trim(),
          phone: normalizedPhone,
          email: normalizedEmail,
          company: company ? String(company).trim() : null,
          userId: user.id,
          isRegistered: true,
          isOnShift: true,
        },
      });

      return { user, owner };
    });

    const token = await createMobileToken({
      userId: result.user.id,
      ownerId: result.owner.id,
      email: result.user.email,
      role: 'OWNER',
    });

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      owner: {
        id: result.owner.id,
        city: result.owner.city,
        rating: result.owner.rating,
      },
    });
  }

  // === Сценарий 4: Пользователя нет — обычная регистрация ===
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: String(name).trim(),
        role: 'OWNER',
      },
    });

    const owner = await tx.owner.create({
      data: {
        name: String(name).trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        company: company ? String(company).trim() : null,
        userId: user.id,
        isRegistered: true,
        isOnShift: true,
      },
    });

    return { user, owner };
  });

  const token = await createMobileToken({
    userId: result.user.id,
    ownerId: result.owner.id,
    email: result.user.email,
    role: 'OWNER',
  });

  return NextResponse.json({
    ok: true,
    token,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    owner: {
      id: result.owner.id,
      city: result.owner.city,
      rating: result.owner.rating,
    },
  });
}
