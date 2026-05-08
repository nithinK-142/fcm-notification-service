import { useTheme } from "@/context/ThemeContext"
import { Toaster } from "react-hot-toast"

function AppToaster() {
  const { dark } = useTheme()

  const toastDark = !dark;

  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: toastDark
            ? "rgba(20,20,20,0.9)"      // dark soft
            : "rgba(255,255,255,0.9)",  // light soft
          color: toastDark
            ? "#f4f4f5"                 // soft white
            : "#18181b",                // soft black
          border: toastDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)", // glass effect
          WebkitBackdropFilter: "blur(10px)",
        }
      }}
    />
  )
}

export default AppToaster;