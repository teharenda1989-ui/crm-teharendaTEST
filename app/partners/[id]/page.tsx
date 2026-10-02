'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PartnerUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface Partner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  cities: string[];
  royaltyPercent: number;
  isActive: boolean;
  comment: string | null;
  maxBotToken: string | null;
  users: PartnerUser[];
}

export default function PartnerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const [showToken, setShowToken] = useState(false);

  // Города
  const [allCities, setAllCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((data) => {
        // На случай, если cities не массив
        const cities = Array.isArray(data.cities) ? data.cities : [];
        setPartner({ ...data, cities });
      })
      .catch(() => setError('Не удалось загрузить партнёра'))
      .finally(() => setLoading(false));
  };

  const loadAllCities = () => {
    // Получаем все города из всех партнёров (SUPER_ADMIN видит все)
    fetch('/api/partners')
      .then((r) => r.json())
      .then((data: any[]) => {
        const set = new Set<string>();
        data.forEach((p) => {
          if (p.city && p.city.trim()) set.add(p.city.trim());
          if (Array.isArray(p.cities)) {
            p.cities.forEach((c: string) => {
              if (c && c.trim()) set.add(c.trim());
            });
          }
        });
        setAllCities(Array.from(set).sort());
      })
      .catch(() => setAllCities([]));
  };

  useEffect(() => {
    load();
    loadAllCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    setError('');
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partner.name,
          phone: partner.phone,
          city: partner.city,
          cities: partner.cities,
          royaltyPercent: partner.royaltyPercent,
          comment: partner.comment,
          isActive: partner.isActive,
          maxBotToken: partner.maxBotToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
      loadAllCities();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm('Удалить партнёра и его учётную запись? Действие необратимо.')
    )
      return;

    try {
      await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      router.push('/partners');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setResetMsg('Пароль минимум 6 символов');
      return;
    }

    try {
      const res = await fetch(`/api/partners/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResetMsg(data.error || 'Ошибка');
        return;
      }

      setResetMsg('✅ Пароль изменён');
      setNewPassword('');
      setTimeout(() => {
        setShowReset(false);
        setResetMsg('');
      }, 2000);
    } catch (e: any) {
      setResetMsg(e.message);
    }
  };

  // Города: добавить
  const handleAddCity = () => {
    if (!partner || !selectedCity) return;
    if (partner.cities.includes(selectedCity)) {
      setSelectedCity('');
      return;
    }
    setPartner({
      ...partner,
      cities: [...partner.cities, selectedCity].sort(),
    });
    setSelectedCity('');
  };

  // Города: удалить
  const handleRemoveCity = (city: string) => {
    if (!partner) return;
    setPartner({
      ...partner,
      cities: partner.cities.filter((c) => c !== city),
    });
  };

  if (loading) {
    return <div className="text-slate-500">Загрузка...</div>;
  }

  if (!partner) {
    return <div className="text-slate-500">Партнёр не найден</div>;
  }

  // Города, которые можно добавить (которых ещё нет у партнёра)
  const availableToAdd = allCities.filter(
    (c) => !partner.cities.includes(c),
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/partners" className="text-slate-500 hover:text-slate-900">
          ← Назад к партнёрам
        </Link>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold">{partner.name}</h1>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={partner.isActive}
                onChange={(e) =>
                  setPartner({ ...partner, isActive: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-600">Активен</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">
                Название
              </label>
              <input
                type="text"
                value={partner.name}
                onChange={(e) =>
                  setPartner({ ...partner, name: e.target.value })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Основной город
              </label>
              <input
                type="text"
                value={partner.city || ''}
                onChange={(e) =>
                  setPartner({ ...partner, city: e.target.value })
                }
                placeholder="Новосибирск"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
              <p className="text-xs text-slate-400 mt-1">
                Отображается как основной. Полный список городов ниже.
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Телефон
              </label>
              <input
                type="text"
                value={partner.phone || ''}
                onChange={(e) =>
                  setPartner({ ...partner, phone: e.target.value })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Процент роялти (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={partner.royaltyPercent}
                onChange={(e) =>
                  setPartner({
                    ...partner,
                    royaltyPercent: Number(e.target.value) || 0,
                  })
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">
                Комментарий
              </label>
              <textarea
                value={partner.comment || ''}
                onChange={(e) =>
                  setPartner({ ...partner, comment: e.target.value })
                }
                rows={3}
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* ГОРОДА ПАРТНЁРА */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">🏙 Города партнёра</h2>
          <p className="text-sm text-slate-500 mb-4">
            Партнёр сможет создавать заявки по этим городам. Исполнители
            мобильного приложения, указавшие один из этих городов, будут
            получать его заявки.
          </p>

          {partner.cities.length === 0 ? (
            <div className="text-sm text-slate-500 mb-4">
              Пока нет городов. Добавьте ниже.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {partner.cities.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm font-medium"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => handleRemoveCity(c)}
                    className="text-orange-600 hover:text-orange-900 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-3 py-2"
            >
              <option value="">— Выберите город для добавления —</option>
              {availableToAdd.length === 0 ? (
                <option value="" disabled>
                  Нет доступных городов
                </option>
              ) : (
                availableToAdd.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleAddCity}
              disabled={!selectedCity}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              + Добавить
            </button>
          </div>

          {availableToAdd.length === 0 && allCities.length > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              Все существующие города уже добавлены. Чтобы добавить новый
              город — создайте партнёра с этим городом.
            </p>
          )}

          <p className="text-xs text-slate-400 mt-3">
            Не забудьте нажать <b>«Сохранить»</b> внизу, чтобы применить
            изменения.
          </p>
        </div>

        {/* MAX Bot Token */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">
            🟣 MAX Bot Token партнёра
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Партнёр создаёт своего бота в MAX для партнёров, присылает вам
            токен. Вставьте его сюда — заявки партнёра будут уходить в MAX от
            имени <b>его</b> бота. Если поле пустое — используется общий бот.
          </p>

          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={partner.maxBotToken || ''}
              onChange={(e) =>
                setPartner({ ...partner, maxBotToken: e.target.value })
              }
              placeholder="Вставьте токен из MAX для партнёров"
              className="flex-1 border border-slate-300 rounded px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="px-4 py-2 rounded border border-slate-300 hover:bg-slate-100 text-sm whitespace-nowrap"
            >
              {showToken ? '🙈 Скрыть' : '👁 Показать'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Учётная запись</h2>

          {partner.users.length === 0 ? (
            <p className="text-slate-500 text-sm">
              У партнёра нет учётной записи. Он не сможет войти в систему.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {partner.users.map((u) => (
                <div
                  key={u.id}
                  className="border border-slate-200 rounded p-4"
                >
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-sm text-slate-500">{u.email}</div>
                      {u.lastLoginAt && (
                        <div className="text-xs text-slate-400 mt-1">
                          Последний вход:{' '}
                          {new Date(u.lastLoginAt).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReset(!showReset)}
                      className="text-sm px-3 py-1 rounded border border-slate-300 hover:bg-slate-100"
                    >
                      🔑 Сменить пароль
                    </button>
                  </div>

                  {showReset && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Новый пароль (мин. 6 символов)"
                          className="flex-1 border border-slate-300 rounded px-3 py-2 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700 whitespace-nowrap"
                        >
                          Сменить
                        </button>
                      </div>
                      {resetMsg && (
                        <div className="mt-2 text-sm text-slate-600">
                          {resetMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Сохраняем...' : saved ? '✅ Сохранено' : '💾 Сохранить'}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-3 rounded bg-red-50 text-red-700 hover:bg-red-100"
          >
            🗑 Удалить партнёра
          </button>
        </div>
      </form>
    </div>
  );
}
