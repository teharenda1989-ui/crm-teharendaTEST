'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  if (isLogin) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 w-full">
        <div className="p-3 pt-14 lg:p-8 lg:pt-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </>
  );
}
