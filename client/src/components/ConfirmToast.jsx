import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/context/ThemeContext"

function ConfirmToastContent({ message, toastId, resolve }) {
    const { dark } = useTheme()

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{message}</p>
            <div className="flex items-center justify-end gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    style={{
                        borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                        color: dark ? "#f4f4f5" : "#18181b",
                        background: dark ? "#212121" : "#dedede",
                    }}
                    onClick={() => { toast.dismiss(toastId); resolve(false) }}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { toast.dismiss(toastId); resolve(true) }}
                >
                    Confirm
                </Button>
            </div>
        </div>
    )
}

export const confirmToast = (message) => new Promise((resolve) => {
    toast((t) => <ConfirmToastContent message={message} toastId={t.id} resolve={resolve} />, { duration: Infinity })
})