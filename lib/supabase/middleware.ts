import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!(supabaseUrl && supabaseAnonKey)) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
    )
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({
          request,
        })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  // Refresh the session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect app routes - redirect to sign-in if not authenticated
  const isAppRoute =
    request.nextUrl.pathname.startsWith('/assets') ||
    request.nextUrl.pathname.startsWith('/upload') ||
    request.nextUrl.pathname.startsWith('/tags') ||
    request.nextUrl.pathname.startsWith('/settings')

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute =
    request.nextUrl.pathname === '/sign-in' ||
    request.nextUrl.pathname === '/sign-up'

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/assets'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
