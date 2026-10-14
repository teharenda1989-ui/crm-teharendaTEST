import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';

  // Собираем WHERE
  const where: any = { ...scopeWhere(scope) };
  if (city) where.city = city;
  if (search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const owners = await prisma.owner.findMany({
    where,
    include: {
      vehicles: category ? { where: { category } } : true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Группируем: категория → массив уникальных владельцев
  const byCategory = new Map<string, any[]>();
  const seen = new Set<string>(); // `${category}::${ownerId}`

  for (const owner of owners) {
    for (const vehicle of owner.vehicles) {
      const key = `${vehicle.category}::${owner.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!byCategory.has(vehicle.category)) byCategory.set(vehicle.category, []);
      byCategory.get(vehicle.category)!.push(owner);
    }
  }

  // Создаём workbook
  const wb = XLSX.utils.book_new();

  // Порядок листов: сначала канонические рубрики, потом остальные
  const canonical = VEHICLE_CATEGORIES.filter((c) => byCategory.has(c));
  const others = Array.from(byCategory.keys()).filter(
    (c) => !VEHICLE_CATEGORIES.includes(c),
  );
  const orderedCategories = [...canonical, ...others];

  const headers = [
    'Телефон',
    'Имя',
    'Цена',
    'Минималка',
    'Адрес',
    'Город',
    'Компания',
    'Дополнительная информация',
  ];

  for (const cat of orderedCategories) {
    const catOwners = byCategory.get(cat)!;

    const rows: any[][] = [headers];
    for (const o of catOwners) {
      // Все телефоны через перенос строки — импорт их разберёт
      const phones = [o.phone, o.extraPhones].filter(Boolean).join('\n');

      rows.push([
        phones,
        o.name || '',
        o.pricePerHour ?? '',
        o.minHours ?? '',
        o.address || '',
        o.city || '',
        o.company || '',
        o.additionalInfo || '',
      ]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 18 }, // Телефон
      { wch: 24 }, // Имя
      { wch: 10 }, // Цена
      { wch: 12 }, // Минималка
      { wch: 32 }, // Адрес
      { wch: 16 }, // Город
      { wch: 22 }, // Компания
      { wch: 45 }, // Доп.информация
    ];

    // Excel: имя листа ≤31 символа
    const sheetName = cat.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  }

  // Если ничего нет — делаем пустой лист с шапкой
  if (!wb.SheetNames.length) {
    const empty = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, empty, 'Владельцы');
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `Владельцы техники - ${date}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
    },
  });
}