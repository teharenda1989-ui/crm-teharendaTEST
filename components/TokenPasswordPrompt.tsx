'use client';

import { useState } from 'react';

export default function TokenPasswordPrompt({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/partners/verify-token-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Неверный пароль');
      }

      setPassword('');
      onVerified();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">🔒 Просмотр токенов</h3>
        <p className="text-sm text-slate-500 mb-4">
          Введите пароль, чтобы увидеть токены партнёров.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="w-full border border-slate-300 rounded px-3 py-2 mb-3"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-slate-300 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Проверяем...' : 'Показать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
