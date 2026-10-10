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
      // ✅ Не затираем поля «Исполнитель», если пользователь их редактирует
      setOrder((prev) => {
        if (!prev) return data;

        const userEditedName =
          prev.assigneeName !== null &&
          prev.assigneeName !== '' &&
          prev.assigneeName !== data.assigneeName;
        const userEditedPhone =
          prev.assigneePhone !== null &&
          prev.assigneePhone !== '' &&
          prev.assigneePhone !== data.assigneePhone;

        return {
          ...data,
          assigneeName: userEditedName ? prev.assigneeName : data.assigneeName,
          assigneePhone: userEditedPhone ? prev.assigneePhone : data.assigneePhone,
        };
      });
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
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded font-medium">
                  ✅ Успешно
                </span>
              )}
              {order.result === 'FAIL' && (
                <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded font-medium">
                  ❌ Отклонена
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-500 text-right">
            <div>
              Создана: {new Date(order.createdAt).toLocaleString('ru-RU')}
            </div>
            {hasGroups && (
              <div className="mt-1">
                Отправлено в: {order.groups.map((g) => g.group.title).join(', ')}
              </div>
            )}
            {order.publishedInApp && (
              <div className="mt-1 text-orange-600 font-medium">
                📱 Опубликовано в приложении
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTake && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border-l-4 border-cyan-500">
          <h2 className="text-lg font-semibold mb-4">🚜 Исполнитель</h2>

          {activeTake.status === 'COMPLETED_PENDING' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded p-4">
              <div className="font-medium text-amber-900 mb-1">
                ⏳ Исполнитель отметил заявку как выполненную
              </div>
              <div className="text-sm text-amber-700">
                Подтвердите выполнение заказа, чтобы закрыть заявку как
                «Успешно».
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500">Имя</div>
              <div className="font-medium">{activeTake.owner.name}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Телефон</div>
              <a
                href={`tel:${activeTake.owner.phone}`}
                className="font-medium text-green-600 hover:underline"
              >
                {activeTake.owner.phone}
              </a>
            </div>
            <div>
              <div className="text-sm text-slate-500">Рейтинг</div>
              <div className="font-medium text-amber-600">
                {ratingStars(activeTake.owner.rating)}{' '}
                <span className="text-slate-900">
                  {activeTake.owner.rating.toFixed(1)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Выполнено заказов</div>
              <div className="font-medium">
                {activeTake.owner.completedOrders}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Взял</div>
              <div className="font-medium">
                {formatDateTime(activeTake.takenAt)}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Статус</div>
              <div className="font-medium">
                {activeTake.status === 'TAKEN' && '⏳ В работе'}
                {activeTake.status === 'COMPLETED_PENDING' &&
                  '⏳ Ждёт подтверждения'}
                {activeTake.status === 'DONE' && '✅ Подтверждено'}
                {activeTake.status === 'CANCELED' && '❌ Отклонена'}
              </div>
            </div>
          </div>

          {activeTake.status === 'TAKEN' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              {!contactsShared ? (
                <button
                  type="button"
                  onClick={handleShareContacts}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  📞 Поделиться контактами клиента
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded font-medium">
                    ✅ Данные клиента отправлены
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatDateTime(activeTake.clientContactsSharedAt)}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTake.status === 'COMPLETED_PENDING' && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleConfirmComplete}
                disabled={saving}
                className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-medium disabled:opacity-50"
              >
                ✅ Подтвердить выполнение
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Данные заявки</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Рубрика *
              </label>
              <input
                type="text"
                value={order.category}
                onChange={(e) =>
                  setOrder({ ...order, category: e.target.value })
                }
                required
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Город</label>
              <input
                type="text"
                value={order.city || ''}
                onChange={(e) => setOrder({ ...order, city: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">
                Дата и время *
              </label>
              <input
                type="datetime-local"
                value={toLocalDatetime(order.startAt)}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    startAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">
                Детали
              </label>
              <textarea
                value={order.description || ''}
                onChange={(e) =>
                  setOrder({ ...order, description: e.target.value })
                }
                rows={3}
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
          <h2 className="text-lg font-semibold mb-2">
            👤 Данные клиента (не уходят в группы и приложение)
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Видны только диспетчеру. Исполнитель получит их после нажатия
            кнопки «Поделиться контактами».
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Имя клиента
              </label>
              <input
                type="text"
                value={order.clientName || ''}
                onChange={(e) =>
                  setOrder({ ...order, clientName: e.target.value })
                }
                placeholder="Иван Петрович"
                disabled={contactsShared}
                className={`w-full border border-slate-300 rounded px-3 py-2 ${
                  contactsShared ? 'bg-slate-100 text-slate-500' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Телефон клиента
              </label>
              <input
                type="text"
                value={order.clientPhone || ''}
                onChange={(e) =>
                  setOrder({ ...order, clientPhone: e.target.value })
                }
                placeholder="+7 999 123-45-67"
                disabled={contactsShared}
                className={`w-full border border-slate-300 rounded px-3 py-2 ${
                  contactsShared ? 'bg-slate-100 text-slate-500' : ''
                }`}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Исполнитель (вручную)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Имя</label>
              <input
                type="text"
                value={order.assigneeName || ''}
                onChange={(e) =>
                  setOrder({ ...order, assigneeName: e.target.value })
                }
                placeholder="Иван Петров"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Телефон
              </label>
              <input
                type="text"
                value={order.assigneePhone || ''}
                onChange={(e) =>
                  setOrder({ ...order, assigneePhone: e.target.value })
                }
                placeholder="+7 999 123-45-67"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            {ownerSuggest && (
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                <div className="text-blue-900 font-medium mb-1">
                  🔍 Найден в базе владельцев:
                </div>
                <div className="text-slate-700">
                  <b>{ownerSuggest.name}</b>
                  {ownerSuggest.company && ` · ${ownerSuggest.company}`}
                  <button
                    type="button"
                    onClick={() =>
                      setOrder({ ...order, assigneeName: ownerSuggest.name })
                    }
                    className="ml-3 text-blue-600 hover:underline text-xs"
                  >
                    Подставить имя
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ✅ Блок создания нового исполнителя */}
          {showCreateOwnerBlock && !showCreate && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-4">
              <div className="font-medium text-amber-900 mb-1">
                ⚠️ Такого исполнителя нет в базе
              </div>
              <div className="text-sm text-amber-700 mb-3">
                Добавить нового владельца техники?
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 text-sm font-medium"
              >
                + Создать исполнителя
              </button>
            </div>
          )}

          {showCreate && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="font-medium text-slate-900">
                  🆕 Новый исполнитель
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-slate-500 hover:text-slate-900 text-sm"
                >
                  ✕ Отмена
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Город *
                  </label>
                  <select
                    value={newOwnerCity}
                    onChange={(e) => setNewOwnerCity(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">— Выберите —</option>
                    {availableCities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={order.assigneeName || ''}
                    onChange={(e) =>
                      setOrder({ ...order, assigneeName: e.target.value })
                    }
                    placeholder="Введите имя"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Телефон
                  </label>
                  <input
                    type="text"
                    value={order.assigneePhone || ''}
                    onChange={(e) =>
                      setOrder({ ...order, assigneePhone: e.target.value })
                    }
                    placeholder="+7 999 123-45-67"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">
                    Рубрики (минимум 1) *
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded p-2 bg-white">
                    {VEHICLE_CATEGORIES.map((cat) => {
                      const checked = newOwnerCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`cursor-pointer px-3 py-1 rounded-full text-xs border ${
                            checked
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={() => {
                              setNewOwnerCategories((prev) =>
                                prev.includes(cat)
                                  ? prev.filter((c) => c !== cat)
                                  : [...prev, cat],
                              );
                            }}
                          />
                          {cat}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCreateOwner}
                  disabled={creating}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  {creating ? 'Создаём...' : '💾 Создать исполнителя'}
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  Остальные данные (адрес, компания) можно будет дозаполнить в
                  карточке «Владельцы техники».
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Финансы</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                💰 Сумма оборота, ₽ *
              </label>
              <input
                type="number"
                value={order.orderAmount ?? ''}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    orderAmount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                required
                min="1"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                📊 Диспетчерские, ₽ *
              </label>
              <input
                type="number"
                value={order.commissionAmount ?? ''}
                onChange={(e) =>
                  setOrder({
                    ...order,
                    commissionAmount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                required
                min="1"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Диспетчер</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Имя</label>
              <input
                type="text"
                value={order.dispatcher}
                onChange={(e) =>
                  setOrder({ ...order, dispatcher: e.target.value })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Телефон
              </label>
              <input
                type="text"
                value={order.dispatcherPhone}
                onChange={(e) =>
                  setOrder({ ...order, dispatcherPhone: e.target.value })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || isFullyClosed}
            className="bg-slate-900 text-white px-6 py-3 rounded hover:bg-slate-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Сохраняем...' : saved ? '✅ Сохранено' : '💾 Сохранить'}
          </button>

          {/* ✅ Кнопка видна, только если есть группы */}
          {canCloseSearch && (
            <button
              type="button"
              onClick={handleCloseSearch}
              disabled={saving}
              className="bg-yellow-100 text-yellow-800 px-6 py-3 rounded hover:bg-yellow-200 font-medium"
            >
              🔒 Закрыть поиск
            </button>
          )}

          {canReopen && (
            <button
              type="button"
              onClick={handleReopen}
              disabled={saving}
              className="bg-white border border-slate-300 px-6 py-3 rounded hover:bg-slate-100"
            >
              🔓 Переоткрыть поиск
            </button>
          )}

          {order.status === 'ACTIVE' && (
            <>
              <button
                type="button"
                onClick={() => handleComplete('SUCCESS')}
                disabled={saving}
                className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-medium"
              >
                ✅ Завершить успешно
              </button>
              <button
                type="button"
                onClick={() => handleComplete('FAIL')}
                disabled={saving}
                className="bg-red-50 text-red-700 px-6 py-3 rounded hover:bg-red-100 font-medium"
              >
                ❌ Без сделки
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
