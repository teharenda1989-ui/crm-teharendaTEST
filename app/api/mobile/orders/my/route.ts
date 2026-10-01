import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, getBearerToken } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = await verifyMobileToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const ownerIds = (
    await prisma.owner.findMany({
      where: { userId: session.userId },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (!ownerIds.length) {
    return NextResponse.json({ inWork: [], completed: [] });
  }

  const takes = await prisma.orderTake.findMany({
    where: { ownerId: { in: ownerIds } },
    include: { order: true },
    orderBy: { takenAt: 'desc' },
  });

  const inWork = takes.filter(
    (t) => t.status === 'TAKEN' || t.status === 'COMPLETED_PENDING',
  );
  const completed = takes.filter(
    (t) => t.status === 'DONE' || t.status === 'CANCELED',
  );

  return NextResponse.json({ inWork, completed });
}
