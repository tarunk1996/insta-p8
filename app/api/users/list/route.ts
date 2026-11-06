import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, page_id, business_account_id, updated_at")
      .order("updated_at", { ascending: false })

    if (error) throw error

    // Format IDs as safe strings (avoid BigInt float rounding)
    // Filter out internal / dummy entries like "9999999999"
    const safeUsers = (users || [])
      .filter(u => u.username && !u.username.startsWith("test_"))
      .map(u => ({
        id: String(u.id),
        username: u.username,
        business_account_id: u.business_account_id ? String(u.business_account_id) : String(u.id),
        page_id: u.page_id || String(u.id),
      }))

    return NextResponse.json({ users: safeUsers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
