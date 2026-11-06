"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"

export interface ConnectedAccount {
    id: string
    username: string
    profilePic?: string | null
    page_id?: string
    business_account_id?: string
}

export function useInstagramSession() {
    const [username, setUsername] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [profilePic, setProfilePic] = useState<string | null>(null)
    const [availableAccounts, setAvailableAccounts] = useState<ConnectedAccount[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const searchParams = useSearchParams()
    const router = useRouter()

    const refreshAccounts = useCallback(async () => {
        try {
            const res = await fetch("/api/users/list")
            const data = await res.json()
            if (data?.users && Array.isArray(data.users)) {
                setAvailableAccounts(data.users)
            }
        } catch (e) {
            console.warn("Failed to load connected accounts:", e)
        }
    }, [])

    useEffect(() => {
        const code = searchParams.get("code")

        const handleSession = async () => {
            // CASE A: New Login from OAuth Callback
            if (code) {
                try {
                    const res = await fetch("/api/instagram/callback", {
                        method: "POST",
                        body: JSON.stringify({ code }),
                    })
                    const data = await res.json()

                    if (data.success) {
                        localStorage.setItem("ig_user_id", data.userId)
                        localStorage.setItem("ig_username", data.username)
                        if (data.profilePic) localStorage.setItem("ig_profile_pic", data.profilePic)

                        setUserId(data.userId)
                        setUsername(data.username)
                        setProfilePic(data.profilePic || null)
                        await refreshAccounts()
                        router.replace("/dashboard")
                    } else if (data.error) {
                        console.error("Login failed:", data.error)
                        alert(data.error + (data.hint ? `\n\n${data.hint}` : ""))
                        router.replace("/")
                    }
                } catch (err) {
                    console.error("Login failed:", err)
                    router.replace("/")
                }
            }
            // CASE B: Restore Session from LocalStorage
            else {
                const savedId = localStorage.getItem("ig_user_id")
                const savedName = localStorage.getItem("ig_username")

                if (savedId && savedName) {
                    setUserId(savedId)
                    setUsername(savedName)
                    setProfilePic(localStorage.getItem("ig_profile_pic"))
                }
                await refreshAccounts()
            }
            setIsLoading(false)
        }

        handleSession()
    }, [searchParams, router, refreshAccounts])

    const switchAccount = (account: ConnectedAccount) => {
        localStorage.setItem("ig_user_id", account.id)
        localStorage.setItem("ig_username", account.username)
        if (account.profilePic) {
            localStorage.setItem("ig_profile_pic", account.profilePic)
        } else {
            localStorage.removeItem("ig_profile_pic")
        }
        document.cookie = `insta_session=${JSON.stringify({ username: account.username, userId: account.id })}; path=/; max-age=5184000; SameSite=Lax;`
        setUserId(account.id)
        setUsername(account.username)
        setProfilePic(account.profilePic || null)
        window.location.reload()
    }

    const logout = () => {
        localStorage.removeItem("ig_user_id")
        localStorage.removeItem("ig_username")
        localStorage.removeItem("ig_profile_pic")
        document.cookie = "insta_session=; Max-Age=0; path=/;"
        setUsername(null)
        setUserId(null)
        setProfilePic(null)
        router.push("/")
    }

    return { userId, username, profilePic, isLoading, availableAccounts, switchAccount, refreshAccounts, logout }
}
