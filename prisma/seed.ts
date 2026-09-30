import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Офис';

  if (!email || !password) {
    console.log(
      '⚠️  ADMIN_EMAIL или ADMIN_PASSWORD не заданы — пропускаем создание админа',
    );
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const passwordHash = await bcrypt.hash(String(password), 10);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        name,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log(`✅ Админ ${normalizedEmail} обновлён`);
  } else {
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log(`✅ Админ ${normalizedEmail} создан`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Ошибка seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
