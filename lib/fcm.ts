import { getFirebaseMessaging } from './firebase';
import { prisma } from './prisma';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true },
  });

  if (!user?.fcmToken) return;

  try {
    await getFirebaseMessaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: data ?? {},
      android: { priority: 'high' },
    });
  } catch (e) {
    console.error('FCM send error:', e);
  }
}

export async function sendPushToOwners(
  city: string,
  category: string,
  payload: { title: string; body: string; orderId: string },
) {
  const owners = await prisma.owner.findMany({
    where: {
      city,
      isOnShift: true,
      isActive: true,
      vehicles: { some: { category } },
      userId: { not: null },
    },
    select: { userId: true },
  });

  const userIds = owners
    .map((o) => o.userId)
    .filter((id): id is string => !!id);

  if (!userIds.length) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, fcmToken: { not: null } },
    select: { fcmToken: true },
  });

  const fcmTokens = users
    .map((u) => u.fcmToken)
    .filter((t): t is string => !!t);

  if (!fcmTokens.length) return;

  try {
    await getFirebaseMessaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title: payload.title, body: payload.body },
      data: { orderId: payload.orderId, type: 'NEW_ORDER' },
      android: { priority: 'high' },
    });
  } catch (e) {
    console.error('FCM multicast error:', e);
  }
}