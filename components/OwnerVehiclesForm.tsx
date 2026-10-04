'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';

interface Vehicle {
  id: string;
  category: string;
  comment: string | null;
}

interface Props {
  ownerId: string;
  initialVehicles: Vehicle[];
}

export default function OwnerVehiclesForm({
  ownerId,
  initialVehicles,
}: Props) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Категории, которых ещё нет у владельца
  const myCategories = vehicles.map((v) => v.category);
  const availableCategories = VEHICLE_CATEGORIES.filter(
    (c) => !myCategories.includes(c),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/owners/${ownerId}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setVehicles([...vehicles, data]);
      setSelectedCategory('');
      setComment('');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить технику?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/owners/${ownerId}/vehicles/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ошибка');
      }
      setVehicles(vehicles.filter((v) => v.id !== id));
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {vehicles.length === 0 ? (
        <p className="text-slate-500 mb-4">Техника не добавлена.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="border border-slate-200 rounded p-4 flex justify-between items-start gap-3"
            >
              <div>
                <div className="font-medium text-slate-900">{v.category}</div>
                {v.comment && (
                  <div className="text-sm text-slate-500 mt-1">{v.comment}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(v.id)}
                disabled={saving}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                🗑 Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div>
          <label className="block text-xs text-slate-600 mb-1">Рубрика *</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2"
          >
            <option value="">— Выберите рубрику —</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">
            Комментарий
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ивановец 25т"
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !selectedCategory}
            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : '+ Добавить технику'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded p-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
