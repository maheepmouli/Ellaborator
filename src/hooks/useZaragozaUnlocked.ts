import { useCallback, useEffect, useState } from "react";
import {
  ZARAGOZA_LOCK_EVENT,
  ZARAGOZA_UNLOCK_EVENT,
  isZaragozaUnlocked,
  lockZaragoza,
  unlockZaragoza,
  verifyZaragozaPassword,
} from "@/lib/zaragozaAccess";

export function useZaragozaUnlocked() {
  const [unlocked, setUnlocked] = useState(() => isZaragozaUnlocked());

  useEffect(() => {
    const sync = () => setUnlocked(isZaragozaUnlocked());
    window.addEventListener(ZARAGOZA_UNLOCK_EVENT, sync);
    window.addEventListener(ZARAGOZA_LOCK_EVENT, sync);
    return () => {
      window.removeEventListener(ZARAGOZA_UNLOCK_EVENT, sync);
      window.removeEventListener(ZARAGOZA_LOCK_EVENT, sync);
    };
  }, []);

  const tryUnlock = useCallback((password: string): boolean => {
    if (!verifyZaragozaPassword(password)) return false;
    unlockZaragoza();
    setUnlocked(true);
    return true;
  }, []);

  const lock = useCallback(() => {
    lockZaragoza();
    setUnlocked(false);
  }, []);

  return { unlocked, tryUnlock, lock };
}
