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
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || process.env.INSTAGRAM_APP_ID
    const clientSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Env Vars: Check INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET")
    }

    let accessToken = ""
    let loginUserId = ""
    let businessAccountId = ""
    let username = ""
    let profilePic: string | null = null
    let expiresIn = 5184000

    // 2. Try Unified Login token exchange (Facebook Graph API)
    try {
      const fbTokenUrl = `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      const fbRes = await fetch(fbTokenUrl)
      const fbData = await fbRes.json()

      if (fbRes.ok && fbData.access_token) {
        accessToken = fbData.access_token
        expiresIn = fbData.expires_in || 5184000

        // Fetch assigned Instagram accounts
        const assignedRes = await fetch(
          `https://graph.facebook.com/v24.0/me/assigned_instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
        )
        const assignedData = await assignedRes.json()
        if (assignedData?.data?.[0]?.id) {
          const igAccount = assignedData.data[0]
          loginUserId = igAccount.id.toString()
          businessAccountId = igAccount.id.toString()
          username = igAccount.username || igAccount.name || `user_${loginUserId}`
          profilePic = igAccount.profile_picture_url || null
        } else {
          // If no assigned Instagram accounts via Unified Login, reset accessToken to try direct Instagram login exchange
          console.warn("[v0] No assigned Instagram accounts found via Unified Login, trying direct Instagram token exchange")
          accessToken = ""
        }
      }
    } catch (e) {
      console.warn("[v0] Unified login exchange failed, trying direct Instagram OAuth:", e)
    }

    // 3. Fallback to Legacy Instagram Login if Unified Login did not produce a token
    if (!accessToken) {
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
      if (!tokenRes.ok) {
        if (tokenData.error_message?.includes("authorization code has been used")) {
          return NextResponse.json({ error: "Code already used" }, { status: 400 })
        }
        console.error("[v0] 🔴 Token Error:", JSON.stringify(tokenData, null, 2))
        return NextResponse.json({ error: tokenData.error_description || "Token failed" }, { status: 400 })
      }

      const shortToken = tokenData.access_token
      loginUserId = tokenData.user_id.toString()

      // Exchange for Long Token (60 Days)
      const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`
      const longRes = await fetch(longLivedUrl)
      const longData = await longRes.json()
      accessToken = longData.access_token || shortToken
      expiresIn = longData.expires_in || 5184000
      username = `user_${loginUserId}`
      businessAccountId = loginUserId

      try {
        const meRes = await fetch(
          `https://graph.instagram.com/v24.0/me?fields=user_id,username,profile_picture_url&access_token=${accessToken}`
        )
        const meData = await meRes.json()
        if (meData.username) username = meData.username
        if (meData.profile_picture_url) profilePic = meData.profile_picture_url
        if (meData.user_id) businessAccountId = meData.user_id.toString()
      } catch (e) {
        console.error("[v0] /me request failed:", e)
      }
    }

    // 6. Save/Update User
    const supabase = await getSupabaseServerClient()

    const updates: any = {
      username,
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      business_account_id: businessAccountId,
      page_id: businessAccountId, // Always keep in sync
    }

    console.log(`[v0] 💾 Saving user: ${username} | id=${loginUserId} | biz_id=${businessAccountId}`)

    const { error: upsertError } = await supabase
      .from("users")
      .upsert({ id: loginUserId, ...updates }, { onConflict: "id" })

    if (upsertError) throw upsertError

    const response = NextResponse.json({ success: true, username, userId: loginUserId, profilePic })
    response.cookies.set("insta_session", JSON.stringify({ username, userId: loginUserId }), {
      path: "/",
      maxAge: expiresIn,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return response

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
