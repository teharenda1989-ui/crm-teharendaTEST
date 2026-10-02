import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';

export async function GET() {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  // ПАРТНЁР — только его города
  if (!scope.isSuperAdmin) {
    const partners = await prisma.partner.findMany({
      where: scopeWhere(scope),
      select: { city: true, cities: true },
    });

    const set = new Set<string>();
    for (const p of partners) {
      if (p.city && p.city.trim()) set.add(p.city.trim());
      for (const c of p.cities ?? []) {
        if (c && c.trim()) set.add(c.trim());
      }
    }

    return NextResponse.json({
      cities: Array.from(set).sort(),
      isSuperAdmin: false,
    });
  }

  // SUPER_ADMIN — все города всех партнёров
  const partners = await prisma.partner.findMany({
    where: { isActive: true },
    select: { city: true, cities: true },
  });

  const set = new Set<string>();
  for (const p of partners) {
    if (p.city && p.city.trim()) set.add(p.city.trim());
    for (const c of p.cities ?? []) {
      if (c && c.trim()) set.add(c.trim());
    }
  }

  return NextResponse.json({
    cities: Array.from(set).sort(),
    isSuperAdmin: true,
  });
}
