import { FormEvent, useEffect, useRef, useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { useZaragozaUnlocked } from "@/hooks/useZaragozaUnlocked";

type GateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
  onCancel?: () => void;
};

/** Modal password prompt used when selecting Zaragoza on the map / elsewhere. */
export function ZaragozaPasswordDialog({
  open,
  onOpenChange,
  onUnlocked,
  onCancel,
}: GateDialogProps) {
  const { tryUnlock } = useZaragozaUnlocked();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unlockedThisOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    unlockedThisOpenRef.current = false;
    setPassword("");
    setError(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const dismiss = () => {
    if (!unlockedThisOpenRef.current) {
      onCancel?.();
    }
    onOpenChange(false);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (tryUnlock(password)) {
      setError(false);
      unlockedThisOpenRef.current = true;
      onOpenChange(false);
      onUnlocked?.();
      return;
    }
    setError(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (!unlockedThisOpenRef.current) {
            onCancel?.();
          }
          onOpenChange(false);
          return;
        }
        onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-md border-border-color bg-card sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink">
            <Lock className="h-5 w-5 text-violet" />
            Zaragoza access restricted
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Zaragoza partners have restricted publication of this city’s data and visuals.
            Enter the project password to unlock Zaragoza. Access ends when you leave Zaragoza or
            refresh the page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3 pt-1">
          <Input
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            className={error ? "border-red focus-visible:ring-red" : undefined}
            aria-invalid={error}
          />
          {error && (
            <p className="text-sm text-red" role="alert">
              Incorrect password. Try again.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" className="bg-violet text-primary-foreground hover:bg-violet/90">
              Unlock Zaragoza
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AccessWallProps = {
  children?: React.ReactNode;
  title?: string;
  /** When false, skip the site Header (parent already rendered one). */
  showHeader?: boolean;
};

/**
 * Full-page blocker for Zaragoza routes.
 * Renders children only after successful unlock.
 */
export function ZaragozaAccessWall({
  children,
  title = "Zaragoza",
  showHeader = true,
}: AccessWallProps) {
  const { unlocked, tryUnlock, lock } = useZaragozaUnlocked();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      lock();
    };
  }, [lock]);

  if (unlocked) return <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tryUnlock(password)) {
      setError(false);
      return;
    }
    setError(true);
  };

  return (
    <div className={showHeader ? "min-h-screen bg-background" : undefined}>
      {showHeader && <Header />}
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border-color bg-card p-8 shadow-md">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet/15 text-violet">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">{title} is password protected</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Zaragoza partners have restricted publication of this city’s data and visuals.
            Enter the project password to continue. Access ends when you leave or refresh.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className={error ? "border-red focus-visible:ring-red" : undefined}
              aria-invalid={error}
            />
            {error && (
              <p className="text-sm text-red" role="alert">
                Incorrect password. Try again.
              </p>
            )}
            <Button type="submit" className="w-full bg-violet text-primary-foreground hover:bg-violet/90">
              Unlock Zaragoza
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
