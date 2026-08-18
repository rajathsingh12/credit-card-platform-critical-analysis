import { NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { exportCatalog } from '@/admin/catalog-export'

export const runtime = 'nodejs'

export async function GET() {
  const now = new Date()
  const catalog = await exportCatalog(pool, now)
  const filename = `catalog-${catalog.catalogVersion}.json`

  return new NextResponse(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
