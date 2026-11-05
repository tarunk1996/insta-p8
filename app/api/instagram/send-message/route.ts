import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

/**
 * POST /api/instagram/send-message
 * Send a DM reply to an Instagram user
 *
 * Request body:
 * {
 *   "user_id": 123456,
 *   "recipient_id": 789012,
 *   "message": "Your reply text here"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id, recipient_id, message } = await request.json()

    if (!user_id || !recipient_id || !message) {
      return NextResponse.json({ error: "Missing required fields: user_id, recipient_id, message" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    // Get user's access token
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("access_token, username, business_account_id, page_id")
      .eq("id", user_id)
      .single()

    if (userError || !user) {
      console.error("[v0] Failed to get user:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] Sending DM from", user.username, "to", recipient_id)

    // Send message via Instagram API (Try graph.facebook.com with target ID, fallback to graph.instagram.com)
    const targetId = user.page_id || process.env.INSTAGRAM_APP_ID || (user.business_account_id ? String(user.business_account_id) : "me")
    const sendUrl = `https://graph.facebook.com/v24.0/${targetId}/messages?access_token=${encodeURIComponent(user.access_token)}`

    let response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: recipient_id.toString(),
        },
        message: {
          text: message,
        },
      }),
    })

    let data = await response.json()

    if (!response.ok && (data.error?.code === 100 || data.error?.code === 190)) {
      const fallbackUrl = `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(user.access_token)}`
      const fallbackRes = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipient_id.toString() },
          message: { text: message },
        }),
      })
      const fallbackData = await fallbackRes.json()
      if (fallbackRes.ok && !fallbackData.error) {
        response = fallbackRes
        data = fallbackData
      }
    }

    if (!response.ok) {
      console.error("[v0] Failed to send message:", data)
      return NextResponse.json({ error: data.error?.message || "Failed to send message" }, { status: 400 })
    }

    console.log("[v0] Message sent successfully:", data.message_id)

    // Store the sent message in database
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user_id)
      .eq("recipient_id", recipient_id)
      .single()

    if (conversation) {
      await supabase.from("messages").insert({
        id: data.message_id,
        conversation_id: conversation.id,
        user_id,
        sender_id: user_id,
        sender_username: user.username,
        content: message,
        is_from_instagram: false,
      })
    }

    return NextResponse.json({
      success: true,
      message_id: data.message_id,
    })
  } catch (error) {
    console.error("[v0] Send message error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
