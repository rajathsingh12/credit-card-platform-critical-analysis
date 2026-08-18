import { NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { generateChangeFeed } from '@/admin/change-feed'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sinceParam = searchParams.get('since')

  if (!sinceParam) {
    return NextResponse.json(
      { error: 'Missing required query parameter: since (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  const sinceDate = new Date(sinceParam)
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date format for "since" parameter. Expected YYYY-MM-DD.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const feed = await generateChangeFeed(pool, sinceDate, now)
  const filename = `change-feed-${feed.sinceDate}-to-${feed.feedDate}.json`

  return new NextResponse(JSON.stringify(feed, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
