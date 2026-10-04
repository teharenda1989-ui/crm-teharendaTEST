import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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
    cities: Array.from(set).sort((a, b) => a.localeCompare(b, 'ru')),
  });
}
