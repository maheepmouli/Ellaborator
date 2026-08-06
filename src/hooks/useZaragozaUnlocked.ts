import { useCallback, useEffect, useState } from "react";
import {
  ZARAGOZA_UNLOCK_EVENT,
  isZaragozaUnlocked,
  unlockZaragoza,
  verifyZaragozaPassword,
} from "@/lib/zaragozaAccess";

export function useZaragozaUnlocked() {
  const [unlocked, setUnlocked] = useState(() => isZaragozaUnlocked());

  useEffect(() => {
    const sync = () => setUnlocked(isZaragozaUnlocked());
    window.addEventListener(ZARAGOZA_UNLOCK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ZARAGOZA_UNLOCK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const tryUnlock = useCallback((password: string): boolean => {
    if (!verifyZaragozaPassword(password)) return false;
    unlockZaragoza();
    setUnlocked(true);
    return true;
  }, []);

  return { unlocked, tryUnlock };
}
