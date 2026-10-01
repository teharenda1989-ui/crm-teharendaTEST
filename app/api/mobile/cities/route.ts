import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const partners = await prisma.partner.findMany({
    where: { isActive: true, city: { not: null } },
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