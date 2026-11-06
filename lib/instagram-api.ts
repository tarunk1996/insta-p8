const GRAPH = process.env.INSTAGRAM_GRAPH_URL || "https://graph.facebook.com/v24.0"
const LEGACY_GRAPH = "https://graph.instagram.com/v24.0"

export interface IGButton {
  type: "web_url" | "postback"
  title: string
  url?: string
  payload?: string
}

export interface IGCard {
  title: string
  subtitle?: string
  image_url?: string
  buttons: IGButton[]
}

export interface QuickReply {
  title: string
  payload: string
}

export interface SendResult {
  ok: boolean
  id?: string
  error?: any
}

function resolveMessagePath(path: string, accountId?: string): string {
  if (path.startsWith("me/messages")) {
    const target = accountId || process.env.INSTAGRAM_ACCOUNT_ID
    if (target && target !== "me") {
      return `${target}/messages`
    }
  }
  return path
}

async function post(path: string, token: string, body: any, accountId?: string): Promise<SendResult> {
  const resolvedPath = resolveMessagePath(path, accountId)
  try {
    const res = await fetch(`${GRAPH}/${resolvedPath}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok || json.error) {
      if (GRAPH !== LEGACY_GRAPH && (json.error?.code === 100 || json.error?.code === 190)) {
        try {
          const fallbackRes = await fetch(`${LEGACY_GRAPH}/${path}?access_token=${encodeURIComponent(token)}`, {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          const fallbackJson = await fallbackRes.json()
          if (fallbackRes.ok && !fallbackJson.error) {
            return { ok: true, id: fallbackJson.id || fallbackJson.message_id }
          }
        } catch {}
      }
      console.error(`[ig-api] ${resolvedPath} failed:`, JSON.stringify(json.error))
      return { ok: false, error: json.error || `HTTP ${res.status}` }
    }
    return { ok: true, id: json.id || json.message_id }
  } catch (e) {
    console.error(`[ig-api] ${resolvedPath} network error:`, e)
    return { ok: false, error: e }
  }
}

export function buildCardAttachment(card: IGCard) {
  const buttons = (card.buttons || [])
    .filter((b) => b.title)
    .map((b) => ({
      type: b.type,
      title: b.title,
      url: b.type === "web_url" ? b.url : undefined,
      payload: b.type === "postback" ? b.payload : undefined,
    }))
  const element: any = { title: card.title, buttons }
  if (card.subtitle) element.subtitle = card.subtitle
  if (card.image_url?.startsWith("http")) element.image_url = card.image_url
  return {
    attachment: {
      type: "template",
      payload: { template_type: "generic", elements: [element] },
    },
  }
}

/**
 * Build the follower-gate card shown to non-followers. Centralized so the
 * comment, story, and DM branches all share the same copy and the same
 * `as const` button types — preserving the `"web_url"` / `"postback"`
 * literal types that `IGButton` requires.
 */
export function buildFollowGateCard(params: {
  username: string
  ruleId: string
  title?: string
  subtitle?: string
}): IGCard {
  return {
    title: params.title ?? "Before you lose me",
    subtitle: params.subtitle ?? `Follow @${params.username} to unlock this content!`,
    buttons: [
      { type: "web_url", url: `https://instagram.com/${params.username}`, title: "Follow" },
      { type: "postback", title: "I Followed! ✅", payload: `UNLOCK_CONTENT_${params.ruleId}` },
    ],
  }
}

export async function sendTextDM(
  token: string,
  recipient: { id?: string; comment_id?: string },
  text: string,
  quickReplies?: QuickReply[],
  accountId?: string,
): Promise<SendResult> {
  const message: any = { text }
  if (quickReplies?.length) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.title.slice(0, 20),
      payload: q.payload,
    }))
  }
  return post("me/messages", token, { recipient, message }, accountId)
}

export async function sendCardDM(
  token: string,
  recipient: { id?: string; comment_id?: string },
  card: IGCard,
  accountId?: string,
): Promise<SendResult> {
  return post("me/messages", token, { recipient, message: buildCardAttachment(card) }, accountId)
}

export async function sendMediaDM(
  token: string,
  recipient: { id?: string; comment_id?: string },
  mediaType: "image" | "video" | "audio",
  url: string,
  accountId?: string,
): Promise<SendResult> {
  return post("me/messages", token, {
    recipient,
    message: { attachment: { type: mediaType, payload: { url } } },
  }, accountId)
}

export async function sendSenderAction(
  token: string,
  recipientId: string,
  action: "typing_on" | "typing_off" | "mark_seen",
  accountId?: string,
): Promise<SendResult> {
  return post("me/messages", token, { recipient: { id: recipientId }, sender_action: action }, accountId)
}

export async function sendMessageReaction(
  token: string,
  recipientId: string,
  messageId: string,
  reaction = "love",
  accountId?: string,
): Promise<SendResult> {
  return post("me/messages", token, {
    recipient: { id: recipientId },
    sender_action: "react",
    payload: { message_id: messageId, reaction },
  }, accountId)
}

export async function replyToComment(token: string, commentId: string, message: string): Promise<SendResult> {
  return post(`${commentId}/replies`, token, { message })
}

export async function fetchProfile(token: string, igUserId: string): Promise<{ username?: string; name?: string } | null> {
  try {
    let res = await fetch(`${GRAPH}/${igUserId}?fields=username,name&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) })
    let json = await res.json()
    if ((!res.ok || json.error) && GRAPH !== LEGACY_GRAPH) {
      res = await fetch(`${LEGACY_GRAPH}/${igUserId}?fields=username,name&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) })
      json = await res.json()
    }
    if (!res.ok || json.error) return null
    return json
  } catch {
    return null
  }
}

export async function verifyIdOwnership(token: string, id: string): Promise<boolean> {
  try {
    let res = await fetch(`${GRAPH}/${id}?fields=id&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok && GRAPH !== LEGACY_GRAPH) {
      res = await fetch(`${LEGACY_GRAPH}/${id}?fields=id&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) })
    }
    return res.ok
  } catch {
    return false
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, Math.min(ms, 8000)))
}
