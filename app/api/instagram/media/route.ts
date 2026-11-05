import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const supabase = await getSupabaseServerClient()

    // 1. Get Access Token and Business Account ID
    const { data: user } = await supabase
      .from("users")
      .select("access_token, business_account_id, page_id")
      .eq("id", userId)
      .single()

    if (!user?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 })
    }

    // 2. Fetch Media: Try graph.facebook.com (Unified Login) then fallback to graph.instagram.com
    const targetId = user.page_id || process.env.INSTAGRAM_APP_ID || (user.business_account_id ? String(user.business_account_id) : "me")
    let url = `https://graph.facebook.com/v24.0/${targetId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=24&access_token=${user.access_token}`
    let res = await fetch(url, { cache: 'no-store' })
    let data = await res.json()

    if (data.error && (data.error.code === 100 || data.error.code === 190)) {
      // Fallback for legacy Instagram Basic Display / legacy tokens
      const fallbackUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=24&access_token=${user.access_token}`
      const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store' })
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.error) {
        data = fallbackData
      }
    }

    if (data.error) {
      console.error("[v0] Instagram Media Error:", data.error)
      // Agar Token Invalid hai, to user ko Logout karne bolenge frontend pe
      if (data.error.code === 190) {
         return NextResponse.json({ error: "Session Expired. Please Logout & Login." }, { status: 401 })
      }
      return NextResponse.json({ error: data.error.message }, { status: 500 })
    }

    // Normalize: pick thumbnail_url for videos, media_url for images.
    // Skips items with neither URL so we never return the broken `image_url: null` shape.
    const normalized = (data.data || [])
      .map((m: any) => ({
        ...m,
        image_url: m.thumbnail_url || m.media_url || null,
      }))
      .filter((m: any) => typeof m.image_url === "string" && m.image_url.length > 0)

    return NextResponse.json({ data: normalized })
  } catch (error) {
    console.error("[v0] Server Error:", error)
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}
