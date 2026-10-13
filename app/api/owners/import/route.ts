import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, scopeWhere } from '@/lib/scope';
import { normalizeCategory, VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';
import * as XLSX from 'xlsx';

/** Извлекает ВСЕ телефоны из ячейки (переносы строк, запятые, |, ;) */
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

  // === ПРЕДПРОСМОТР ===
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
        category: normalized,
        originalSheet: sheetName,
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

    const category = normalizeCategory(sheetName);

    const headers = rows[0].map((h) => String(h));
    const nameCol = findCol(headers, ['хозяин', 'имя', 'название', 'фио']);
    const priceCol = findCol(headers, ['цена']);
    const minCol = findCol(headers, ['минимал']);

    // 🆕 КАЖДАЯ строка с телефоном = отдельная карточка. Имя НЕ наследуется.
    type ParsedRow = {
      name: string;
      phone: string;
      extraPhones: string | null;
      pricePerHour: number | null;
      minHours: number | null;
      additionalInfo: string | null;
    };
    const parsed: ParsedRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cellPhones = extractPhones(row[0]);
      if (!cellPhones.length) continue;

      const phone = cellPhones[0];
      const extraPhones = cellPhones.slice(1).join(', ') || null;

      const rawName = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
      const name = rawName || 'Без имени';

      const pricePerHour = priceCol >= 0 ? extractNumber(row[priceCol]) : null;
      const minHours = minCol >= 0 ? extractNumber(row[minCol]) : null;

      // Доп.информация — все неслужебные столбцы
      const infoParts: string[] = [];
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j];
        const v = String(row[j] || '').trim();
        if (!v || !h) continue;
        const hl = h.toLowerCase();
        if (OWNER_ONLY_HEADERS.some((x) => hl.includes(x))) continue;
        if (j === priceCol || j === minCol) continue;
        infoParts.push(`${h}: ${v}`);
      }

      parsed.push({
        name,
        phone,
        extraPhones,
        pricePerHour,
        minHours,
        additionalInfo: infoParts.join(' · ') || null,
      });
    }

    if (!parsed.length) {
      results.push({
        sheet: sheetName, category, originalSheet: sheetName, rows: 0,
        ownersCreated: 0, ownersUpdated: 0, vehiclesCreated: 0, vehiclesSkipped: 0,
        errors: ['Не найдено ни одного телефона'],
      });
      continue;
    }

    const errors: string[] = [];

    try {
      const allPhones = parsed.map((r) => r.phone);

      // Существующие владельцы
      const existing = await prisma.owner.findMany({
        where: { phone: { in: allPhones }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true, phone: true },
      });
      const existingPhones = new Set(existing.map((o) => o.phone));

      // Создаём новых
      const toCreate = parsed
        .filter((o) => !existingPhones.has(o.phone))
        .map((o) => ({ ...o, partnerId }));
      let ownersCreated = 0;
      if (toCreate.length) {
        const res = await prisma.owner.createMany({ data: toCreate, skipDuplicates: true });
        ownersCreated = res.count;
      }
      const ownersUpdated = parsed.length - ownersCreated;

      // Обновляем существующих (заливаем новые поля)
      for (const o of parsed) {
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

      // Перечитываем всех, чтобы получить id
      const allOwners = await prisma.owner.findMany({
        where: { phone: { in: allPhones }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true, phone: true },
      });
      const idByPhone = new Map(allOwners.map((o) => [o.phone, o.id]));

      // Vehicle — по одной на каждый уникальный телефон
      let vehiclesCreated = 0;
      let vehiclesSkipped = 0;
      const vehiclesToCreate: { ownerId: string; category: string }[] = [];

      for (const r of parsed) {
        const ownerId = idByPhone.get(r.phone);
        if (!ownerId) continue;
        const exists = await prisma.vehicle.findFirst({ where: { ownerId, category } });
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
        rows: parsed.length,
        ownersCreated, ownersUpdated, vehiclesCreated, vehiclesSkipped, errors,
      });
    } catch (e: any) {
      results.push({
        sheet: sheetName, category, originalSheet: sheetName,
        rows: parsed.length,
        ownersCreated: 0, ownersUpdated: 0, vehiclesCreated: 0, vehiclesSkipped: 0,
        errors: [`Ошибка: ${e.message}`],
      });
    }
  }

  return NextResponse.json({ preview: false, results, cleared });
}
