'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  result: 'SUCCESS' | 'FAIL';
}

export default function CompleteOrderButton({ orderId, result }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isSuccess = result === 'SUCCESS';
  const label = isSuccess ? '✅ Завершить успешно' : '❌ Без сделки';
  const color = isSuccess
    ? 'bg-green-600 text-white hover:bg-green-700'
    : 'bg-red-50 text-red-700 hover:bg-red-100';

  const handleComplete = async () => {
    if (loading) return;
    const confirmText = isSuccess
      ? 'Завершить заявку как УСПЕШНУЮ?'
      : 'Завершить заявку как БЕЗ СДЕЛКИ?';
    if (!confirm(confirmText)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      
      // Даем пользователю 1 секунду увидеть, что все ок, и перекидываем на список заявок
      setTimeout(() => {
        router.push('/orders'); // Переход на страницу со списком
        router.refresh();       // Принудительно сбрасываем кэш, чтобы заявка пропала из "Новых" и появилась в "Успешных"
      }, 1000);
      
    } catch (e: any) {
      alert(e.message);
      setLoading(false); // Снимаем лоадинг только в случае ошибки, при успехе компонент размонтируется
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className={`text-sm px-3 py-1 rounded ${color} disabled:opacity-50`}
    >
      {loading ? 'Завершаем...' : label}
    </button>
  );
}
