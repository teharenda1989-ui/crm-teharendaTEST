import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function GET() {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const partners = await prisma.partner.findMany({
    where: {
      isActive: true,
      ...scopeWhere(scope),
    },
    select: { city: true },
  });

  const cities = Array.from(
    new Set(
      partners
        .map((p) => p.city?.trim())
        .filter((c): c is string => !!c && c.length > 0),
    ),
  ).sort();

  return NextResponse.json({ cities });
}