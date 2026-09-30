'use client';

import { useEffect, useState } from 'react';

interface Group {
  id: string;
  title: string;
  chatId: string;
  category: string | null;
  isActive: boolean;
  messenger: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [chatId, setChatId] = useState('');
  const [category, setCategory] = useState('');
  const [messenger, setMessenger] = useState<'telegram' | 'max'>('telegram');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => setGroups(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          chatId,
          category: category || null,
          messenger,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      setTitle('');
      setChatId('');
      setCategory('');
      setMessenger('telegram');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить группу?')) return;
    await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    load();
  };

  const handleToggle = async (g: Group) => {
    await fetch(`/api/groups/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !g.isActive }),
    });
    load();
  };

  const tgGroups = groups.filter((g) => g.messenger === 'telegram');
  const maxGroups = groups.filter((g) => g.messenger === 'max');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Группы</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">Добавить группу</h2>

          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Мессенджер <span className="text-red-500">*</span>
              </label>
              <select
                value={messenger}
                onChange={(e) =>
                  setMessenger(e.target.value as 'telegram' | 'max')
                }
                className="w-full border border-slate-300 rounded px-3 py-2"
              >
                <option value="telegram">✈️ Telegram</option>
                <option value="max">🟣 MAX</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Экскаваторы Москва"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Chat ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                required
                placeholder="-1001234567890"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Рубрика (опционально)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Экскаватор колёсный"
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Сохраняем...' : 'Добавить'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Telegram */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">✈️</span>
              Telegram-группы ({tgGroups.length})
            </h2>

            {loading ? (
              <p className="text-slate-500">Загрузка...</p>
            ) : tgGroups.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Нет добавленных Telegram-групп
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {tgGroups.map((g) => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </div>

          {/* MAX */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">🟣</span>
              MAX-группы ({maxGroups.length})
            </h2>

            {loading ? (
              <p className="text-slate-500">Загрузка...</p>
            ) : maxGroups.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Нет добавленных MAX-групп
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {maxGroups.map((g) => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Инструкция для партнёров */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6 text-sm text-blue-900">
        <h3 className="font-semibold mb-4 text-base">
          📖 Инструкция для партнёров
        </h3>

        {/* Telegram */}
        <div className="mb-6">
          <div className="font-semibold mb-2 flex items-center gap-2">
            <span>✈️</span>
            <span>Инструкция по боту Telegram</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 ml-1">
            <li>
              Добавьте бота <b>@teharendaproBOT</b> в свою группу как
              участника.
            </li>
            <li>Напишите в группе любое сообщение — например, «тест».</li>
            <li>Запросите Chat ID у головного офиса (администратора).</li>
            <li>
              В личном кабинете откройте раздел «Группы» и добавьте:
              <div className="ml-4 mt-1 text-blue-800">
                — Мессенджер: <b>Telegram</b>
                <br />— Название: любое
                <br />— Chat ID: полученный от администратора
                <br />— Рубрика: на ваше усмотрение (или пусто)
              </div>
            </li>
          </ol>
        </div>

        {/* MAX */}
        <div className="mb-6">
          <div className="font-semibold mb-2 flex items-center gap-2">
            <span>🟣</span>
            <span>Инструкция по боту MAX</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 ml-1">
            <li>
              Зарегистрируйтесь как ИП или ООО на площадке{' '}
              <a
                href="https://business.max.ru/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                business.max.ru
              </a>
            </li>
            <li>
              Создайте бота — например, <b>teharendaproBOT142</b>.
            </li>
            <li>
              После прохождения модерации скопируйте токен бота и передайте
              его в головной офис.
            </li>
            <li>
              Найдите бота в приложении MAX через поиск → нажмите «Старт».
              <br />
              Затем перейдите в свою группу → «Добавить участников» → найдите
              бота → добавьте.
              <br />
              После добавления напишите в группе любое сообщение — бот
              активируется.
            </li>
            <li>Запросите Chat ID у головного офиса.</li>
            <li>
              В личном кабинете откройте раздел «Группы» и добавьте:
              <div className="ml-4 mt-1 text-blue-800">
                — Мессенджер: <b>MAX</b>
                <br />— Название: любое
                <br />— Chat ID: полученный от администратора
                <br />— Рубрика: на ваше усмотрение (или пусто)
              </div>
            </li>
          </ol>
        </div>

        {/* Заметка */}
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-900">
          <b>💡 Заметка:</b> добавляйте бота в группы поэтапно. После
          добавления в каждую конкретную группу напишите администратору — вам
          предоставят Chat ID этой группы.
        </div>
      </div>
    </div>
  );
}

function GroupRow({
  group,
  onDelete,
  onToggle,
}: {
  group: Group;
  onDelete: (id: string) => void;
  onToggle: (g: Group) => void;
}) {
  return (
    <div className="border border-slate-200 rounded p-4 flex justify-between items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{group.title}</span>
          {!group.isActive && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              выкл
            </span>
          )}
          {group.category && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {group.category}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          chatId: <code className="text-xs">{group.chatId}</code>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToggle(group)}
          className="text-sm px-3 py-1 rounded border border-slate-300 hover:bg-slate-100"
        >
          {group.isActive ? 'Выключить' : 'Включить'}
        </button>
        <button
          onClick={() => onDelete(group.id)}
          className="text-sm px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
