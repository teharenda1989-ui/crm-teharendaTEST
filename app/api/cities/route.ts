import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  if (!scope.isSuperAdmin) {
    if (!scope.partnerId) {
      return NextResponse.json({ cities: [], isSuperAdmin: false });
    }

    const partner = await prisma.partner.findUnique({
      where: { id: scope.partnerId },
      select: { city: true, cities: true },
    });

    const set = new Set<string>();
    if (partner) {
      if (partner.city && partner.city.trim()) set.add(partner.city.trim());
      for (const c of partner.cities ?? []) {
        if (c && c.trim()) set.add(c.trim());
      }
    }

    return NextResponse.json({
      cities: Array.from(set).sort(),
      isSuperAdmin: false,
    });
  }

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
