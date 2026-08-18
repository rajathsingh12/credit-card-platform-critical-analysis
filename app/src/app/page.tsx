import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkInviteCode } from '@/beta/invite-db'
import { BETA_COOKIE } from '@/beta/invite'
import HomeClient from './home-client'

export default async function Home() {
  const cookieStore = await cookies()
  const code = cookieStore.get(BETA_COOKIE)?.value
  if (!code) redirect('/invite')
  const status = await checkInviteCode(code)
  if (status !== 'valid') redirect('/invite?revoked=1')
  return <HomeClient />
}
