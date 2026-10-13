import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import * as XLSX from 'xlsx';

function normalizePhone(raw: string | number): string {
  return String(raw).replace(/\D/g, '');
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const lower = name.toLowerCase();
    const idx = headers.findIndex((h) =>
      String(h).toLowerCase().includes(lower),
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

const CHUNK_SIZE = 500;

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const preview = formData.get('preview') === 'true';
  const clearAll = formData.get('clearAll') === 'true';

  if (!file) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // === РЕЖИМ ПРЕДПРОСМОТРА ===
  if (preview) {
    const results: any[] = [];
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === 'Лист1') continue;
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
      });
      if (rows.length < 2) continue;
      const validRows = rows
        .slice(1)
        .filter((r) => normalizePhone(r[0] || '').length >= 10);
      results.push({
        sheet: sheetName,
        category: sheetName,
        rows: validRows.length,
        ownersCreated: 0,
        ownersUpdated: 0,
        vehiclesCreated: 0,
        vehiclesSkipped: 0,
        errors: [],
      });
    }
    return NextResponse.json({ preview: true, results, cleared: 0 });
  }

  // === ОЧИСТКА ===
  let cleared = 0;
  if (clearAll) {
    const where = scopeWhere(scope);
    cleared = await prisma.owner.count({ where });
    await prisma.owner.deleteMany({ where });
  }

  const partnerId = scope.isSuperAdmin ? null : scope.partnerId;
  const results: any[] = [];

  // === ИМПОРТ ===
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'Лист1') continue;

    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    });
    if (rows.length < 2) continue;

    const headers = rows[0].map((h) => String(h));

    // ФИКС: если колонка "номер/телефон" не найдена по имени — берем первую
    let phoneCol = findCol(headers, ['номер', 'телефон']);
    if (phoneCol < 0) phoneCol = 0;

    const nameCol = findCol(headers, ['имя', 'название']);
    const priceCol = findCol(headers, ['цена']);
    const commentCol = findCol(headers, ['коммент', 'статус']);
    const cityCol = findCol(headers, ['город']);
    const addressCol = findCol(headers, ['адрес']);

    const charCols = headers
      .map((_, i) => i)
      .filter(
        (i) =>
          i !== phoneCol &&
          i !== nameCol &&
          i !== priceCol &&
          i !== commentCol &&
          i !== cityCol &&
          i !== addressCol,
      );

    // 1. Парсим все строки в память
    type ParsedRow = {
      phone: string;
      name: string;
      city: string | null;
      address: string | null;
      vehicleComment: string;
    };
    const parsed: ParsedRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const phone = normalizePhone(row[phoneCol]);
      if (phone.length < 10) continue;

      const name = String(row[nameCol] || '').trim() || 'Без имени';
      const price = priceCol >= 0 ? String(row[priceCol] || '').trim() : '';
      const comment =
        commentCol >= 0 ? String(row[commentCol] || '').trim() : '';
      const city = cityCol >= 0 ? String(row[cityCol] || '').trim() : '';
      const address =
        addressCol >= 0 ? String(row[addressCol] || '').trim() : '';

      const chars: string[] = [];
      for (const ci of charCols) {
        const val = String(row[ci] || '').trim();
        if (val && headers[ci]) chars.push(`${headers[ci]}: ${val}`);
      }
      if (price) chars.push(`Цена: ${price}`);
      if (comment) chars.push(`Статус: ${comment}`);

      parsed.push({
        phone,
        name,
        city: city || null,
        address: address || null,
        vehicleComment: chars.join(' · '),
      });
    }

    if (!parsed.length) {
      results.push({
        sheet: sheetName,
        category: sheetName,
        rows: 0,
        ownersCreated: 0,
        ownersUpdated: 0,
        vehiclesCreated: 0,
        vehiclesSkipped: 0,
        errors: ['Не найдено ни одной строки с валидным телефоном'],
      });
      continue;
    }

    const errors: string[] = [];

    try {
      // 2. Уникальные телефоны
      const uniquePhones = Array.from(new Set(parsed.map((r) => r.phone)));

      // 3. Один запрос — найти существующих владельцев
      const existingOwners = await prisma.owner.findMany({
        where: {
          phone: { in: uniquePhones },
          ...(partnerId ? { partnerId } : {}),
        },
        select: { id: true, phone: true },
      });
      const existingByPhone = new Map(existingOwners.map((o) => [o.phone, o.id]));

      // 4. Пакетно создать недостающих владельцев
      const firstByPhone = new Map<string, ParsedRow>();
      for (const r of parsed) {
        if (!firstByPhone.has(r.phone)) firstByPhone.set(r.phone, r);
      }

      const ownersToCreate = uniquePhones
        .filter((p) => !existingByPhone.has(p))
        .map((p) => {
          const r = firstByPhone.get(p)!;
          return {
            phone: r.phone,
            name: r.name,
            city: r.city,
            address: r.address,
            partnerId,
          };
        });

      let ownersCreated = 0;
      if (ownersToCreate.length) {
        const res = await prisma.owner.createMany({
          data: ownersToCreate,
          skipDuplicates: true,
        });
        ownersCreated = res.count;
      }
      const ownersUpdated = uniquePhones.length - ownersCreated;

      // 5. Один запрос — перечитать всех (включая созданных), получить id
      const allOwners = await prisma.owner.findMany({
        where: {
          phone: { in: uniquePhones },
          ...(partnerId ? { partnerId } : {}),
        },
        select: { id: true, phone: true },
      });
      const ownerIdByPhone = new Map(allOwners.map((o) => [o.phone, o.id]));
      const ownerIds = Array.from(ownerIdByPhone.values());

      // 6. Собрать все техники к вставке
      const vehiclesToCreate: {
        ownerId: string;
        category: string;
        comment: string | null;
      }[] = [];
      for (const r of parsed) {
        const ownerId = ownerIdByPhone.get(r.phone);
        if (!ownerId) continue;
        vehiclesToCreate.push({
          ownerId,
          category: sheetName,
          comment: r.vehicleComment || null,
        });
      }

      // 7. Один запрос — существующие техники
      const existingVehicles = ownerIds.length
        ? await prisma.vehicle.findMany({
            where: {
              ownerId: { in: ownerIds },
              category: sheetName,
            },
            select: { ownerId: true, comment: true },
          })
        : [];
      const existingKeys = new Set(
        existingVehicles.map((v) => `${v.ownerId}::${v.comment || ''}`),
      );

      // 8. Отфильтровать дубли и пакетно вставить
      const newVehicles: typeof vehiclesToCreate = [];
      let vehiclesSkipped = 0;
      for (const v of vehiclesToCreate) {
        const key = `${v.ownerId}::${v.comment || ''}`;
        if (existingKeys.has(key)) {
          vehiclesSkipped++;
          continue;
        }
        existingKeys.add(key);
        newVehicles.push(v);
      }

      let vehiclesCreated = 0;
      for (let i = 0; i < newVehicles.length; i += CHUNK_SIZE) {
        const chunk = newVehicles.slice(i, i + CHUNK_SIZE);
        const res = await prisma.vehicle.createMany({ data: chunk });
        vehiclesCreated += res.count;
      }

      results.push({
        sheet: sheetName,
        category: sheetName,
        rows: parsed.length,
        ownersCreated,
        ownersUpdated,
        vehiclesCreated,
        vehiclesSkipped,
        errors,
      });
    } catch (e: any) {
      errors.push(`Ошибка пакетной обработки: ${e.message}`);
      results.push({
        sheet: sheetName,
        category: sheetName,
        rows: parsed.length,
        ownersCreated: 0,
        ownersUpdated: 0,
        vehiclesCreated: 0,
        vehiclesSkipped: 0,
        errors,
      });
    }
  }

  return NextResponse.json({ preview: false, results, cleared });
}
