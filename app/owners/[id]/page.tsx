import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/scope';
import OwnerEditForm from '@/components/OwnerEditForm';
import OwnerVehiclesForm from '@/components/OwnerVehiclesForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

function ratingStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    '★'.repeat(full) +
    (half ? '⯨' : '') +
    '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))
  );
}

export default async function OwnerPage({ params }: Props) {
  const scope = await getScope();

  const owner = await prisma.owner.findUnique({
    where: { id: params.id },
    include: {
      vehicles: { orderBy: { createdAt: 'asc' } },
      takes: {
        select: { status: true },
      },
    },
  });

  if (!owner) notFound();

  const doneCount = owner.takes.filter((t) => t.status === 'DONE').length;
  const canceledCount = owner.takes.filter(
    (t) => t.status === 'CANCELED',
  ).length;

  return (
    <div>
      <div className="mb-4">
        <Link href="/owners" className="text-slate-500 hover:text-slate-900">
          ← Назад к списку
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">{owner.name}</h1>
            {owner.company && (
              <p className="text-slate-500 mb-3">{owner.company}</p>
            )}

            {owner.isRegistered && (
              <div className="mt-2 inline-block bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1 rounded">
                📱 Зарегистрирован в приложении
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-4">
              <a
                href={`tel:${owner.phone}`}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-flex items-center gap-2"
              >
                📞 {owner.phone}
              </a>

              <a
                href={`https://t.me/+${owner.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-flex items-center gap-2"
              >
                ✈️ Telegram
              </a>
            </div>
          </div>

          <div className="text-right text-sm text-slate-500">
            {owner.city && (
              <div>
                Город:{' '}
                <span className="text-slate-900 font-medium">
                  {owner.city}
                </span>
              </div>
            )}
            {owner.address && (
              <div className="mt-1">
                Адрес: <span className="text-slate-900">{owner.address}</span>
              </div>
            )}
            <div className="mt-1">
              Добавлен:{' '}
              <span className="text-slate-900">
                {new Date(owner.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
            {!owner.isActive && (
              <div className="mt-2">
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                  НЕ РАБОТАЕТ
                </span>
              </div>
            )}
          </div>
        </div>

        {owner.isRegistered && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-sm text-slate-500 mb-1">Рейтинг</div>
              <div className="text-xl font-bold text-amber-600">
                {ratingStars(owner.rating)}{' '}
                <span className="text-slate-900">
                  {owner.rating.toFixed(1)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Выполнено</div>
              <div className="text-xl font-bold text-green-600">
                {doneCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Отменено</div>
              <div className="text-xl font-bold text-red-600">
                {canceledCount}
              </div>
            </div>
          </div>
        )}

        {owner.comment && (
          <div className="mt-4 p-3 bg-slate-50 rounded text-slate-700">
            💬 {owner.comment}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          🚜 Техника ({owner.vehicles.length})
        </h2>

        <OwnerVehiclesForm
          ownerId={owner.id}
          initialVehicles={owner.vehicles.map((v) => ({
            id: v.id,
            category: v.category,
            comment: v.comment,
          }))}
        />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Редактирование</h2>
        <OwnerEditForm
          owner={{
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
            company: owner.company,
            city: owner.city,
            address: owner.address,
            lat: owner.lat,
            lng: owner.lng,
            comment: owner.comment,
            notes: owner.notes,
            isActive: owner.isActive,
          }}
        />
      </div>
    </div>
  );
}
