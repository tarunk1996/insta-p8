"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Zap, MessageCircle, Sparkles, ArrowUpRight, Github, Star,
  Send, AtSign, Brain, Inbox, Lock, Terminal,
  Loader2, Plus, Key, X, CheckCircle2,
} from "lucide-react"

const TELEGRAM_URL = "https://t.me/instagramautomationp8"
const GITHUB_URL = "https://github.com/ayuuxh2/insta-p8"

interface ConnectedUser {
  id: string
  username: string
  page_id?: string
  business_account_id?: string
}

export function LandingPage() {
  const [stars, setStars] = useState<number | null>(null)
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([])
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [tokenInput, setTokenInput] = useState("")
  const [usernameInput, setUsernameInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [connectError, setConnectError] = useState("")
  const router = useRouter()

  useEffect(() => {
    fetch("https://api.github.com/repos/ayuuxh2/insta-p8")
      .then(r => r.json())
      .then(d => { if (typeof d.stargazers_count === "number") setStars(d.stargazers_count) })
      .catch(() => {})

    fetch("/api/users/list")
      .then(r => r.json())
      .then(d => {
        if (d?.users && Array.isArray(d.users)) {
          setConnectedUsers(d.users)
        }
      })
      .catch(() => {})
  }, [])

  const handleInstagramLogin = () => {
    const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || "1491371826202741"
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI || `${window.location.origin}/api/instagram/callback`
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID

    if (configId) {
      window.location.href = `https://www.facebook.com/v24.0/dialog/oauth?auth_type=reauthenticate&client_id=${appId}&config_id=${configId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    } else {
      const scopes = [
        "instagram_basic",
        "instagram_manage_messages",
        "instagram_manage_comments",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(",")
      window.location.href = `https://www.facebook.com/v24.0/dialog/oauth?auth_type=reauthenticate&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`
    }
  }

  const handleFacebookLogin = handleInstagramLogin

  const handleLaunchAccount = (user: ConnectedUser) => {
    localStorage.setItem("ig_user_id", user.id)
    localStorage.setItem("ig_username", user.username)
    document.cookie = `insta_session=${JSON.stringify({ username: user.username, userId: user.id })}; path=/; max-age=5184000; SameSite=Lax;`
    router.push("/dashboard")
  }

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setConnectError("")
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/users/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenInput.trim(),
          username: usernameInput.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to connect account")
      }
      localStorage.setItem("ig_user_id", data.user.id)
      localStorage.setItem("ig_username", data.user.username)
      setShowConnectModal(false)
      router.push("/dashboard")
    } catch (err: any) {
      setConnectError(err.message || "Connection failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const fallbackUsers: ConnectedUser[] = [
    { id: "17841460709427648", username: "adab_luxe" },
    { id: "17841402552818155", username: "itarun_kumar" },
  ]
  const displayUsers = connectedUsers.length > 0 ? connectedUsers : fallbackUsers

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] selection:bg-[#ffe14d] selection:text-black overflow-x-hidden antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-serif-display { font-family: 'Instrument Serif', Georgia, serif; }
        .font-mono-ui { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 30s linear infinite; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fade-up .7s cubic-bezier(.2,.7,.2,1) both; }
        .grain::before {
          content: ""; position: fixed; inset: 0; z-index: 5; pointer-events: none; opacity: .04;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
        }
      `}</style>

      <div className="grain" />

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-5 md:px-10 h-16 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#ffe14d] text-black flex items-center justify-center rounded-[6px]">
            <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
          <span className="font-mono-ui text-sm font-bold tracking-tight">insta-p8</span>
          <span className="hidden sm:inline-block font-mono-ui text-[10px] text-neutral-500 border border-white/10 rounded-full px-2 py-0.5">open source</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 font-mono-ui text-xs text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3.5 py-1.5 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Star</span>
            {stars !== null && <span className="text-[#ffe14d]">{stars}</span>}
          </a>

          {/* Quick Account Buttons */}
          {displayUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => handleLaunchAccount(user)}
              className="hidden sm:inline-flex items-center gap-1.5 font-mono-ui text-xs font-bold text-[#ffe14d] border border-[#ffe14d]/40 rounded-full px-3.5 py-1.5 hover:bg-[#ffe14d]/10 transition-colors"
            >
              <Zap className="w-3 h-3" />
              @{user.username}
            </button>
          ))}

          <button
            onClick={handleInstagramLogin}
            className="font-mono-ui text-xs font-bold bg-white text-black rounded-full px-4 py-1.5 hover:bg-[#ffe14d] transition-colors"
          >
            Connect Account
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10">
        <section className="px-5 md:px-10 pt-16 md:pt-28 pb-16 max-w-6xl mx-auto">
          <div className="fade-up" style={{ animationDelay: "0ms" }}>
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Instagram automation // self-hosted // no monthly fees
            </p>
          </div>

          <h1 className="fade-up font-serif-display text-[15vw] md:text-[7.5rem] leading-[0.95] tracking-tight" style={{ animationDelay: "80ms" }}>
            Your DMs,
            <br />
            <span className="italic text-[#ffe14d]">on autopilot.</span>
          </h1>

          <div className="fade-up mt-10 flex flex-col md:flex-row md:items-end gap-8 md:gap-16" style={{ animationDelay: "160ms" }}>
            <p className="text-neutral-400 text-base md:text-lg max-w-md leading-relaxed">
              Comment-to-DM funnels, keyword triggers, story reactions, AI replies, a live inbox,
              and Reels scheduling. The open-source ManyChat alternative — your data stays in your own Supabase.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleInstagramLogin}
                  className="group flex items-center gap-2 bg-[#ffe14d] text-black font-mono-ui text-sm font-bold px-7 py-4 rounded-full hover:scale-[1.03] active:scale-[0.98] transition-transform"
                >
                  <MessageCircle className="w-4 h-4" />
                  Connect with Instagram
                  <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                </button>

                {displayUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleLaunchAccount(user)}
                    className="group flex items-center gap-2 font-mono-ui text-sm font-bold text-[#ffe14d] border border-[#ffe14d]/40 px-6 py-4 rounded-full hover:bg-[#ffe14d]/10 active:scale-[0.98] transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    Open as @{user.username}
                  </button>
                ))}

                <button
                  onClick={() => setShowConnectModal(true)}
                  className="flex items-center gap-2 font-mono-ui text-sm text-neutral-300 border border-white/15 px-5 py-4 rounded-full hover:border-[#ffe14d]/60 hover:text-[#ffe14d] transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Direct Token Connect
                </button>

                <a
                  href={TELEGRAM_URL} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 font-mono-ui text-sm text-neutral-300 border border-white/15 px-6 py-4 rounded-full hover:border-[#2AABEE]/60 hover:text-[#2AABEE] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Telegram support
                </a>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={handleFacebookLogin}
                  className="font-mono-ui text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline underline-offset-4"
                >
                  Log in via Facebook / Meta account (grant @adab_luxe or Pages) →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Modal: Direct Token Connect */}
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#121212] p-6 sm:p-8 text-white shadow-2xl">
              <button
                onClick={() => setShowConnectModal(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-serif-display text-2xl font-bold text-white mb-2">Connect Instagram Account</h2>
              <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                Connect your account directly using your Meta access token. If you have an Instagram account like <span className="text-[#ffe14d]">@adab_luxe</span>, enter the details below to link it instantly.
              </p>

              <form onSubmit={handleManualConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono-ui text-neutral-400 mb-1.5">Instagram Username</label>
                  <input
                    type="text"
                    placeholder="e.g. adab_luxe"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffe14d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-ui text-neutral-400 mb-1.5">Meta Access Token</label>
                  <textarea
                    rows={4}
                    placeholder="Paste Graph API Explorer / System User Access Token here..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#ffe14d]"
                  />
                </div>

                {connectError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                    {connectError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="font-mono-ui text-xs px-4 py-2 text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-lg bg-[#ffe14d] px-5 py-2.5 font-mono-ui text-xs font-bold text-black hover:bg-[#ffe14d]/90 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Connect & Open
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Marquee */}
        <div className="border-y border-white/[0.08] py-3 overflow-hidden">
          <div className="marquee-track flex whitespace-nowrap font-mono-ui text-xs uppercase tracking-[0.2em] text-neutral-600 gap-8 w-max">
            {Array.from({ length: 2 }).map((_, copy) => (
              <div key={copy} className="flex gap-8">
                {["comment → DM", "keyword triggers", "story reactions", "AI auto-reply", "live inbox", "ice breakers", "follow gate", "quick replies", "media attachments", "public + private replies"].map((t) => (
                  <span key={t} className="flex items-center gap-8">
                    {t} <span className="text-[#ffe14d]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Feature grid */}
        <section className="px-5 md:px-10 py-20 max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-10">
            <h2 className="font-serif-display text-4xl md:text-5xl">Everything the paid tools do.</h2>
            <span className="hidden md:block font-mono-ui text-xs text-neutral-600">$0/month</span>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-white/[0.08] border border-white/[0.08]">
            <Feature icon={<MessageCircle className="w-4 h-4" />} title="Comment → DM funnels"
              desc="Keyword or reply-all triggers on any post. Choose DM only, public reply only, or both — with your own rotating public replies." />
            <Feature icon={<Send className="w-4 h-4" />} title="DM keyword automation"
              desc="Auto-respond to DMs with text, media, or rich cards with buttons. Quick-reply chips guide people through your funnel." />
            <Feature icon={<AtSign className="w-4 h-4" />} title="Story triggers"
              desc="React to story mentions, emoji reactions, and story replies. Filter by emoji or keyword." />
            <Feature icon={<Brain className="w-4 h-4" />} title="AI auto-reply"
              desc="Feed it your account context — niche, products, tone — and let AI handle unmatched DMs like a human." />
            <Feature icon={<Inbox className="w-4 h-4" />} title="Live inbox"
              desc="Every conversation in one dashboard. Jump in manually anytime, fire quick responses from your saved automations." />
            <Feature icon={<Lock className="w-4 h-4" />} title="Follow gate"
              desc="Lock content behind a follow. Non-followers get a follow prompt; one tap later they unlock the goods." />
            <Feature icon={<Sparkles className="w-4 h-4" />} title="Human-like sending"
              desc="Optional typing indicators and randomized delays so replies land natural, not botty." />
            <Feature icon={<Terminal className="w-4 h-4" />} title="Self-hosted & hackable"
              desc="Next.js + Supabase. Deploy on free tiers. Read every line, fork it, own your data and your tokens." />
          </div>
        </section>

        {/* Community strip */}
        <section className="px-5 md:px-10 pb-24 max-w-6xl mx-auto">
          <div className="border border-white/[0.08] rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-gradient-to-br from-white/[0.03] to-transparent">
            <div>
              <h3 className="font-serif-display text-3xl md:text-4xl mb-2">Built in the open.</h3>
              <p className="text-neutral-500 text-sm max-w-md">
                Stars, sponsors, and testers keep this project alive. Questions, bugs, feature requests —
                the Telegram chat is where it all happens.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={TELEGRAM_URL} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-[#2AABEE] text-white font-mono-ui text-xs font-bold px-5 py-3 rounded-full hover:brightness-110 transition-all"
              >
                <Send className="w-3.5 h-3.5" /> Join Telegram
              </a>
              <a
                href={GITHUB_URL} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 border border-white/15 text-neutral-300 font-mono-ui text-xs font-bold px-5 py-3 rounded-full hover:border-white/40 transition-colors"
              >
                <Star className="w-3.5 h-3.5 text-[#ffe14d]" /> Star on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-5 md:px-10 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-mono-ui text-[11px] text-neutral-600">
          insta-p8 — open-source Instagram automation. MIT licensed.
        </span>
        <div className="flex items-center gap-5 font-mono-ui text-[11px] text-neutral-500">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-[#2AABEE] transition-colors">Telegram support</a>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-[#0a0a0a] p-7 group hover:bg-[#0f0f0e] transition-colors">
      <div className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-neutral-500 group-hover:text-[#ffe14d] group-hover:border-[#ffe14d]/30 transition-colors mb-5">
        {icon}
      </div>
      <h3 className="font-mono-ui text-sm font-bold text-white mb-2">{title}</h3>
      <p className="text-[13px] text-neutral-500 leading-relaxed">{desc}</p>
    </div>
  )
}
