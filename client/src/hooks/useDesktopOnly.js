import { useEffect, useState } from "react"

const MOBILE_WIDTH = 1024

export default function useDesktopOnly() {
    const [isBlocked, setIsBlocked] = useState(false)
    useEffect(() => {
        const check = () => {
            const isTouch = navigator.maxTouchPoints > 0
            const isSmallScreen = window.innerWidth < MOBILE_WIDTH
            const userAgent = navigator.userAgent.toLowerCase()
            const isMobileUA = /android|iphone|ipad|ipod|mobile|tablet/i.test(userAgent)
            setIsBlocked(isSmallScreen || isTouch || isMobileUA)
        }
        check()
        window.addEventListener("resize", check)
        return () => {
            window.removeEventListener("resize", check)
        }
    }, [])
    return isBlocked
}