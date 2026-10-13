import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { normalizeCategory, VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';
import * as XLSX from 'xlsx';

/** Извлекает ВСЕ телефоны из ячейки (поддерживает переносы строк, запятые, точки с запятой) */
function extractPhones(cell: any): string[] {
  const text = String(cell || '');
  const parts = text.split(/[\n\r,;|]+/);
  const phones: string[] = [];
  for (const p of parts) {
    const digits = p.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 12) phones.push(digits);
  }
  return Array.from(new Set(phones));
}

function extractNumber(cell: any): number | null {
  const text = String(cell || '').trim();
  if (!text) return null;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const lower = name.toLowerCase();
    const idx = headers.findIndex((h) => String(h).toLowerCase().includes(lower));
    if (idx >= 0) return idx;
  }
  return -1;
}

const OWNER_ONLY_HEADERS = ['водител', 'хозяин', 'имя', 'название', 'фио', 'телефон', 'номер', 'цена', 'минимал'];

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

  // === ПРЕДПРОСМОТР (с нормализацией рубрик) ===
  if (preview) {
    const results: any[] = [];
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === 'Лист1') continue;
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rows.length < 2) continue;
      const validRows = rows.slice(1).filter((r) => extractPhones(r[0]).length > 0);
      const normalized = normalizeCategory(sheetName);
      results.push({
        sheet: sheetName,
        category: normalized,          // куда нормализовалась рубрика
        originalSheet: sheetName,      // как в файле
        rows: validRows.length,
        ownersCreated: 0,
        ownersUpdated: 0,
        vehiclesCreated: 0,
        vehiclesSkipped: 0,
        errors: normalized === 'Другое' && !/друг/i.test(sheetName)
          ? [`Лист «${sheetName}» не удалось сопоставить ни с одной рубрикой → пойдёт в «Другое». Доступные рубрики: ${VEHICLE_CATEGORIES.join(', ')}`]
          : [],
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
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // 🔑 Нормализация рубрики из имени листа в каноническую
    const category = normalizeCategory(sheetName);

    const headers = rows[0].map((h) => String(h));
    const nameCol = findCol(headers, ['хозяин', 'имя', 'название', 'фио']);
    const priceCol = findCol(headers, ['цена']);
    const minCol = findCol(headers, ['минимал']);

    // Группируем строки по владельцу (наследуем имя, если в строке пусто)
    type Group = { name: string; phones: string[]; rows: Record<string, string>[] };
    const groups: Group[] = [];
    let current: Group | null = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cellPhones = extractPhones(row[0]);
      const cellName = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';

      if (cellName) {
        current = { name: cellName, phones: [], rows: [] };
        groups.push(current);
      }
      if (!current) {
        current = { name: 'Без имени', phones: [], rows: [] };
        groups.push(current);
      }

      current.phones.push(...cellPhones);

      const raw: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const v = String(row[j] || '').trim();
        if (v && headers[j]) raw[headers[j]] = v;
      }
      current.rows.push(raw);
    }

    for (const g of groups) g.phones = Array.from(new Set(g.phones));
    const validGroups = groups.filter((g) => g.phones.length > 0);

    if (!validGroups.length) {
      results.push({
        sheet: sheetName, category, originalSheet: sheetName, rows: 0,
        ownersCreated: 0, ownersUpdated: 0, vehiclesCreated: 0, vehiclesSkipped: 0,
        errors: ['Не найдено ни одного телефона'],
      });
      continue;
    }

    const errors: string[] = [];

    try {
      const allPhones: string[] = [];
      const ownerPayloads = validGroups.map((g) => {
        const phone = g.phones[0];
        const extraPhones = g.phones.slice(1).join(', ') || null;
        allPhones.push(phone);

        let pricePerHour: number | null = null;
        let minHours: number | null = null;
        const infoParts: string[] = [];

        for (const raw of g.rows) {
          if (pricePerHour == null && priceCol >= 0) {
            pricePerHour = extractNumber(raw[headers[priceCol]]);
          }
          if (minHours == null && minCol >= 0) {
            minHours = extractNumber(raw[headers[minCol]]);
          }
          const parts: string[] = [];
          for (const [k, v] of Object.entries(raw)) {
            const kl = k.toLowerCase();
            if (OWNER_ONLY_HEADERS.some((h) => kl.includes(h))) continue;
            if (headers[priceCol] === k || headers[minCol] === k) continue;
            parts.push(`${k}: ${v}`);
          }
          if (parts.length) infoParts.push(parts.join(' · '));
        }

        return {
          name: g.name,
          phone,
          extraPhones,
          pricePerHour,
          minHours,
          additionalInfo: infoParts.join('\n') || null,
          partnerId,
        };
      });

      // Существующие владельцы
      const existing = await prisma.owner.findMany({
        where: { phone: { in: allPhones }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true, phone: true },
      });
      const existingPhones = new Set(existing.map((o) => o.phone));

      // Создаём новых
      const toCreate = ownerPayloads.filter((o) => !existingPhones.has(o.phone));
      let ownersCreated = 0;
      if (toCreate.length) {
        const res = await prisma.owner.createMany({ data: toCreate, skipDuplicates: true });
        ownersCreated = res.count;
      }
      const ownersUpdated = ownerPayloads.length - ownersCreated;

      // Обновляем существующих
      for (const o of ownerPayloads) {
        if (!existingPhones.has(o.phone)) continue;
        const found = existing.find((e) => e.phone === o.phone);
        if (!found) continue;
        await prisma.owner.update({
          where: { id: found.id },
          data: {
            extraPhones: o.extraPhones,
            pricePerHour: o.pricePerHour,
            minHours: o.minHours,
            additionalInfo: o.additionalInfo,
          },
        });
      }

      // Vehicle создаём уже с НОРМАЛИЗОВАННОЙ категорией
      const allOwners = await prisma.owner.findMany({
        where: { phone: { in: allPhones }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true, phone: true },
      });
      const idByPhone = new Map(allOwners.map((o) => [o.phone, o.id]));

      let vehiclesCreated = 0;
      let vehiclesSkipped = 0;
      const vehiclesToCreate: { ownerId: string; category: string }[] = [];

      for (const g of validGroups) {
        const ownerId = idByPhone.get(g.phones[0]);
        if (!ownerId) continue;
        const exists = await prisma.vehicle.findFirst({
          where: { ownerId, category },
        });
        if (exists) {
          vehiclesSkipped++;
          continue;
        }
        vehiclesToCreate.push({ ownerId, category });
      }

      if (vehiclesToCreate.length) {
        const res = await prisma.vehicle.createMany({ data: vehiclesToCreate });
        vehiclesCreated = res.count;
      }

      results.push({
        sheet: sheetName, category, originalSheet: sheetName,
        rows: validGroups.length,
        ownersCreated, ownersUpdated, vehiclesCreated, vehiclesSkipped, errors,
      });
    } catch (e: any) {
      results.push({
        sheet: sheetName, category, originalSheet: sheetName,
        rows: validGroups.length,
        ownersCreated: 0, ownersUpdated: 0, vehiclesCreated: 0, vehiclesSkipped: 0,
        errors: [`Ошибка: ${e.message}`],
      });
    }
  }

  return NextResponse.json({ preview: false, results, cleared });
}
