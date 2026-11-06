import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, username: inputUsername, accountId: inputAccountId, pageId: inputPageId } = body

    if (!token && !inputUsername) {
      return NextResponse.json({ error: "Access token or username required" }, { status: 400 })
    }

    let resolvedId = inputAccountId ? String(inputAccountId) : ""
    let resolvedUsername = inputUsername ? inputUsername.replace(/^@/, "").trim() : ""
    let resolvedPageId = inputPageId ? String(inputPageId) : resolvedId
    let profilePic: string | null = null

    // If token provided, query Graph API for verification and auto-discovery
    if (token) {
      // 1. Try finding linked Instagram business accounts via /me/accounts
      try {
        const accRes = await fetch(
          `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${token}`
        )
        const accData = await accRes.json()
        if (Array.isArray(accData?.data)) {
          for (const page of accData.data) {
            const ig = page.instagram_business_account
            if (ig?.id) {
              if (!resolvedUsername || ig.username?.toLowerCase() === resolvedUsername.toLowerCase()) {
                resolvedId = ig.id.toString()
                resolvedUsername = ig.username || resolvedUsername
                resolvedPageId = page.id.toString()
                profilePic = ig.profile_picture_url || null
                break
              }
            }
          }
        }
      } catch (e) {
        console.warn("[connect] /me/accounts check failed:", e)
      }

      // 2. Try assigned Instagram accounts (/me/assigned_instagram_accounts)
      if (!resolvedId) {
        try {
          const assRes = await fetch(
            `https://graph.facebook.com/v24.0/me/assigned_instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${token}`
          )
          const assData = await assRes.json()
          if (Array.isArray(assData?.data)) {
            for (const ig of assData.data) {
              if (ig?.id) {
                if (!resolvedUsername || ig.username?.toLowerCase() === resolvedUsername.toLowerCase()) {
                  resolvedId = ig.id.toString()
                  resolvedUsername = ig.username || resolvedUsername
                  resolvedPageId = ig.id.toString()
                  profilePic = ig.profile_picture_url || null
                  break
                }
              }
            }
          }
        } catch (e) {
          console.warn("[connect] /me/assigned_instagram_accounts failed:", e)
        }
      }

      // 3. Try direct Instagram Graph API /me
      if (!resolvedId) {
        try {
          const igRes = await fetch(
            `https://graph.instagram.com/v24.0/me?fields=user_id,username,profile_picture_url&access_token=${token}`
          )
          const igData = await igRes.json()
          const igId = igData.user_id?.toString() || igData.id?.toString()
          if (igId && igData.username) {
            resolvedId = igId
            resolvedUsername = igData.username
            resolvedPageId = igId
            profilePic = igData.profile_picture_url || null
          }
        } catch (e) {
          console.warn("[connect] graph.instagram.com/me failed:", e)
        }
      }
    }

    if (!resolvedId) {
      if (inputAccountId) {
        resolvedId = String(inputAccountId)
      } else {
        return NextResponse.json({
          error: "Could not discover Instagram Business Account ID. Please provide both Account ID and Access Token."
        }, { status: 400 })
      }
    }

    if (!resolvedUsername) {
      resolvedUsername = `user_${resolvedId}`
    }

    const supabase = await getSupabaseServerClient()
    const { error: upsertError } = await supabase
      .from("users")
      .upsert({
        id: resolvedId,
        username: resolvedUsername,
        access_token: token || "",
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        business_account_id: resolvedId,
        page_id: resolvedPageId || resolvedId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })

    if (upsertError) throw upsertError

    const response = NextResponse.json({
      success: true,
      user: {
        id: resolvedId,
        username: resolvedUsername,
        profilePic,
        page_id: resolvedPageId,
        business_account_id: resolvedId,
      }
    })

    response.cookies.set("insta_session", JSON.stringify({ username: resolvedUsername, userId: resolvedId }), {
      path: "/",
      maxAge: 60 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return response
  } catch (error: any) {
    console.error("[connect] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
