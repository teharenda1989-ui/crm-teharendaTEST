'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';

interface OrderTake {
  id: string;
  status: string;
  takenAt: string;
  canceledAt: string | null;
  cancelReason: string | null;
  clientContactsShared: boolean;
  clientContactsSharedAt: string | null;
  owner: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    completedOrders: number;
  };
}

interface Order {
  id: string;
  category: string;
  city: string | null;
  when: string | null;
  startAt: string | null;
  description: string | null;
  dispatcher: string;
  dispatcherPhone: string;
  status: string;
  result: string | null;
  closedInTelegram: boolean;
  closedInApp: boolean;
  assigneeName: string | null;
  assigneePhone: string | null;
  orderAmount: number | null;
  commissionAmount: number | null;
  clientName: string | null;
  clientPhone: string | null;
  publishedInApp: boolean;
  createdAt: string;
  groups: { group: { title: string; chatId: string } }[];
  takes: OrderTake[];
}

interface Owner {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  city: string | null;
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerSuggest, setOwnerSuggest] = useState<Owner | null>(null);

  // Блок «Создать исполнителя»
  const [showCreate, setShowCreate] = useState(false);
  const [newOwnerCity, setNewOwnerCity] = useState('');
  const [newOwnerCategories, setNewOwnerCategories] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const reloadOrder = async () => {
    const r = await fetch(`/api/orders/${id}`);
    if (r.ok) {
      const data = await r.json();
      setOrder(data);
    }
  };

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((data) => setOrder(data))
      .finally(() => setLoading(false));

    fetch('/api/owners')
      .then((r) => r.json())
      .then((data) => setOwners(data))
      .catch(() => {});

    fetch('/api/cities')
      .then((r) => r.json())
      .then((data) => setAvailableCities(data.cities || []))
      .catch(() => {});
  }, [id]);

  // Автообновление каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      reloadOrder();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!order?.assigneePhone) {
      setOwnerSuggest(null);
      return;
    }
    const digits = order.assigneePhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setOwnerSuggest(null);
      return;
    }
    const found = owners.find((o) => o.phone.replace(/\D/g, '') === digits);
    setOwnerSuggest(found || null);
  }, [order?.assigneePhone, owners]);

  // При открытии блока — предвыбираем город заявки
  useEffect(() => {
    if (showCreate && order?.city && !newOwnerCity) {
      setNewOwnerCity(order.city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setError('');
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: order.category,
          city: order.city,
          description: order.description,
          dispatcher: order.dispatcher,
          dispatcherPhone: order.dispatcherPhone,
          assigneeName: order.assigneeName,
          assigneePhone: order.assigneePhone,
          orderAmount: order.orderAmount,
          commissionAmount: order.commissionAmount,
          startAt: order.startAt,
          clientName: order.clientName,
          clientPhone: order.clientPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setSaved(true);

      router.push('/orders');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOwner = async () => {
    if (!order) return;
    if (!newOwnerCity) {
      setError('Выберите город');
      return;
    }
    if (!newOwnerCategories.length) {
      setError('Выберите хотя бы одну рубрику');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/owners/create-from-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: order.assigneeName,
          phone: order.assigneePhone,
          city: newOwnerCity,
          categories: newOwnerCategories,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания');

      // Перезагружаем список владельцев + сбрасываем блок
      const ownersRes = await fetch('/api/owners');
      const ownersData = await ownersRes.json();
      setOwners(ownersData);

      setShowCreate(false);
      setNewOwnerCategories([]);
      setNewOwnerCity('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleShareContacts = async () => {
    if (!confirm('Поделиться контактами клиента с исполнителем?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/share-contacts`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await reloadOrder();
      alert('✅ Контакты отправлены исполнителю');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (
      !confirm(
        'Подтвердить выполнение заявки? Исполнитель получит +0.05 к рейтингу.',
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/confirm-complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      alert('✅ Заявка подтверждена как выполненная');
      router.push('/orders');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  const handleCloseSearch = async () => {
    if (!order) return;

    const hasGroups = order.groups.length > 0;
    const willCloseApp = order.publishedInApp;

    let msg = 'Закрыть поиск?';
    if (hasGroups && willCloseApp) {
      msg = 'Закрыть поиск в группах И в приложении?';
    } else if (hasGroups) {
      msg = 'Закрыть поиск в группах?';
    }

    if (!confirm(msg)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await reloadOrder();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!confirm('Переоткрыть поиск?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/reopen`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      await reloadOrder();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (result: 'SUCCESS' | 'FAIL') => {
    const text =
      result === 'SUCCESS'
        ? 'Завершить заявку как УСПЕШНУЮ?'
        : 'Завершить заявку как БЕЗ СДЕЛКИ?';
    if (!confirm(text)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      router.push('/orders');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить заявку? Действие необратимо.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      router.push('/orders');
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500">Загрузка...</div>;
  if (!order) return <div className="text-slate-500">Заявка не найдена</div>;

  const isFullyClosed = order.status === 'CLOSED';
  const hasGroups = order.groups.length > 0;
  const canCloseSearch =
    order.status === 'ACTIVE' && hasGroups && !order.closedInTelegram;
  const canReopen =
    order.status === 'ACTIVE' && hasGroups && order.closedInTelegram;
  const canComplete =
    order.status === 'ACTIVE' && (!hasGroups || order.closedInTelegram);

  const activeTake = order.takes?.find(
    (t) => t.status === 'TAKEN' || t.status === 'COMPLETED_PENDING',
  );
  const contactsShared = activeTake?.clientContactsShared ?? false;

  const ratingStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      '★'.repeat(full) +
      (half ? '⯨' : '') +
      '☆'.repeat(5 - full - (half ? 1 : 0))
    );
  };

  // «Такой владелец не найден» — показываем блок создания, если введён телефон и имя, а владельца нет
  const showCreateOwnerBlock =
    !ownerSuggest &&
    order.assigneePhone &&
    order.assigneePhone.replace(/\D/g, '').length >= 10 &&
    order.assigneeName &&
    order.assigneeName.trim().length > 0;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex justify-between items-center gap-4 flex-wrap">
        <Link href="/orders" className="text-slate-500 hover:text-slate-900">
          ← Назад к заявкам
        </Link>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="text-sm px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
        >
          🗑 Удалить заявку
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-2">{order.category}</h1>
            <div className="flex gap-2 flex-wrap">
              {order.status === 'ACTIVE' && !order.closedInTelegram && (
                <span
                  className={`text-xs px-3 py-1 rounded font-medium ${
                    hasGroups
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {hasGroups ? '🆕 Новая заявка с отправкой' : '🆕 Новая заявка'}
                </span>
              )}
              {order.status === 'ACTIVE' &&
                order.closedInTelegram &&
                activeTake?.status === 'TAKEN' &&
                !contactsShared && (
                  <span className="text-xs bg-cyan-100 text-cyan-800 px-3 py-1 rounded font-medium">
                    ☎️ Уточнение деталей
                  </span>
                )}
              {order.status === 'ACTIVE' &&
                order.closedInTelegram &&
                activeTake?.status === 'TAKEN' &&
                contactsShared && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded font-medium">
                    ⏳ В работе
                  </span>
                )}
              {activeTake?.status === 'COMPLETED_PENDING' && (
                <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded font-medium">
                  ⏳ Ждёт подтверждения
                </span>
              )}
              {order.result === 'SUCCESS' && (
                <span className="text-xs bg-green-100 text-green-700
