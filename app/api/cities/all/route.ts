import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { RUSSIAN_CITIES } from '@/lib/russian-cities';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  // Все города РФ + города, которые уже есть у партнёров
  const partners = await prisma.partner.findMany({
    select: { city: true, cities: true },
  });

  const set = new Set<string>(RUSSIAN_CITIES);
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