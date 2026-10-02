import { NextResponse } from 'next/server';
import { VEHICLE_CATEGORIES } from '@/lib/vehicle-categories';

export async function GET() {
  return NextResponse.json({ categories: VEHICLE_CATEGORIES });
}