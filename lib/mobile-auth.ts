import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-me',
);

export interface MobileSession {
  userId: string;
  ownerId: string;
  email: string;
  role: 'OWNER';
}

export async function createMobileToken(
  payload: MobileSession,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(SECRET);
}

export async function verifyMobileToken(
  token: string,
): Promise<MobileSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== 'OWNER') return null;
    return {
      userId: payload.userId as string,
      ownerId: payload.ownerId as string,
      email: payload.email as string,
      role: 'OWNER',
    };
  } catch {
    return null;
  }
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.substring(7);
}