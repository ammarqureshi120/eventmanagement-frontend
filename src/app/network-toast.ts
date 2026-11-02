import { toast } from "sonner"

import { setNetworkErrorHandler } from "@/shared/api/network"
import { OFFLINE_MESSAGE } from "@/shared/lib/messages"

/** Fixed toast id: repeated failures update the one toast instead of stacking copies. */
export const NETWORK_TOAST_ID = "network"

/**
 * EXPERIENCE "Network failure": one error toast for every request that never got a response. The user
 * stays on the page and forms keep their data (callers only stop their busy state). Returns the
 * unregister function.
 */
export function registerNetworkToast(): () => void {
  return setNetworkErrorHandler(() => {
    toast.error(OFFLINE_MESSAGE, { id: NETWORK_TOAST_ID })
  })
}
