import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("error", error)
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    const redirectUrl = new URL("/", request.url)
    redirectUrl.searchParams.set("code", code)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.json({ error: "Invalid callback" }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 })

    // 1. Env Vars
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || process.env.INSTAGRAM_APP_ID || "1491371826202741"
    const clientSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Env Vars: Check INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET")
    }

    let accessToken = ""
    let expiresIn = 5184000

    // 2. Token Exchange: Try Facebook Graph API first (Unified / Meta Login)
    try {
      const fbTokenUrl = `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      const fbRes = await fetch(fbTokenUrl)
      const fbData = await fbRes.json()

      if (fbRes.ok && fbData.access_token) {
        accessToken = fbData.access_token
        expiresIn = fbData.expires_in || 5184000
      } else {
        console.warn("[callback] Facebook token exchange rejected:", fbData)
      }
    } catch (e) {
      console.warn("[callback] Facebook token exchange error:", e)
    }

    // 2b. Fallback: Try direct Instagram API token exchange
    if (!accessToken) {
      try {
        const tokenParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        })

        const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        })

        const tokenData = await tokenRes.json()
        if (tokenRes.ok && tokenData.access_token) {
          const shortToken = tokenData.access_token
          const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`
          const longRes = await fetch(longLivedUrl)
          const longData = await longRes.json()
          accessToken = longData.access_token || shortToken
          expiresIn = longData.expires_in || 5184000
        } else {
          console.warn("[callback] Direct Instagram token exchange rejected:", tokenData)
        }
      } catch (e) {
        console.warn("[callback] Direct Instagram token exchange error:", e)
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: "Could not exchange authorization code for access token. Please re-authenticate." }, { status: 400 })
    }

    // 3. Instagram Account Discovery
    interface DiscoveredAccount {
      id: string
      username: string
      name?: string
      profilePic?: string | null
      pageId?: string
      token: string
    }
    const accounts: DiscoveredAccount[] = []

    // 3a. Check Facebook Pages with linked Instagram accounts (/me/accounts)
    try {
      const accountsRes = await fetch(
        `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`
      )
      const accountsData = await accountsRes.json()
      if (Array.isArray(accountsData?.data)) {
        for (const page of accountsData.data) {
          const ig = page.instagram_business_account
          if (ig?.id) {
            accounts.push({
              id: ig.id.toString(),
              username: ig.username || ig.name || `ig_${ig.id}`,
              name: ig.name || page.name,
              profilePic: ig.profile_picture_url || null,
              pageId: page.id.toString(),
              token: page.access_token || accessToken,
            })
          }
        }
      }
    } catch (e) {
      console.warn("[callback] /me/accounts check failed:", e)
    }

    // 3b. Check assigned Instagram accounts (/me/assigned_instagram_accounts)
    try {
      const assignedRes = await fetch(
        `https://graph.facebook.com/v24.0/me/assigned_instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
      )
      const assignedData = await assignedRes.json()
      if (Array.isArray(assignedData?.data)) {
        for (const ig of assignedData.data) {
          if (ig?.id && !accounts.some(a => a.id === ig.id.toString())) {
            accounts.push({
              id: ig.id.toString(),
              username: ig.username || ig.name || `ig_${ig.id}`,
              name: ig.name,
              profilePic: ig.profile_picture_url || null,
              pageId: ig.id.toString(),
              token: accessToken,
            })
          }
        }
      }
    } catch (e) {
      console.warn("[callback] /me/assigned_instagram_accounts check failed:", e)
    }

    // 3c. Check direct Instagram Graph API /me
    try {
      const meRes = await fetch(
        `https://graph.instagram.com/v24.0/me?fields=user_id,username,profile_picture_url&access_token=${accessToken}`
      )
      const meData = await meRes.json()
      const igId = meData.user_id?.toString() || meData.id?.toString()
      if (igId && meData.username && !accounts.some(a => a.id === igId)) {
        accounts.push({
          id: igId,
          username: meData.username,
          profilePic: meData.profile_picture_url || null,
          pageId: igId,
          token: accessToken,
        })
      }
    } catch (e) {
      console.warn("[callback] graph.instagram.com/me check failed:", e)
    }

    // 4. Validate discovered accounts
    if (accounts.length === 0) {
      let fbUserName = ""
      try {
        const meRes = await fetch(`https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${accessToken}`)
        const meData = await meRes.json()
        fbUserName = meData.name || ""
      } catch {}

      return NextResponse.json({
        error: `Logged into Meta as "${fbUserName || "user"}", but no connected Instagram Professional account was found.`,
        hint: "Make sure @adab_luxe is an Instagram Business or Creator account and is linked to your Facebook Page."
      }, { status: 400 })
    }

    // 5. Save all discovered accounts into Supabase users table
    const supabase = await getSupabaseServerClient()
    for (const acc of accounts) {
      console.log(`[callback] 💾 Saving Instagram account: @${acc.username} (id=${acc.id}, page_id=${acc.pageId})`)
      const { error: upsertError } = await supabase
        .from("users")
        .upsert({
          id: acc.id,
          username: acc.username,
          access_token: acc.token,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          business_account_id: acc.id,
          page_id: acc.pageId || acc.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })

      if (upsertError) {
        console.error(`[callback] ❌ Failed to save user @${acc.username}:`, upsertError)
      }
    }

    // 6. Select active account (prefer adab_luxe if present, otherwise first found)
    const activeAccount = accounts.find(a => a.username.toLowerCase() === "adab_luxe") || accounts[0]

    const response = NextResponse.json({
      success: true,
      username: activeAccount.username,
      userId: activeAccount.id,
      profilePic: activeAccount.profilePic,
      accounts: accounts.map(a => ({ id: a.id, username: a.username, profilePic: a.profilePic }))
    })

    response.cookies.set("insta_session", JSON.stringify({ username: activeAccount.username, userId: activeAccount.id }), {
      path: "/",
      maxAge: expiresIn,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return response

  } catch (error: any) {
    console.error("[callback] Exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
