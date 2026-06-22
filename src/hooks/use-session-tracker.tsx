import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startMySession, heartbeatMySession, endMySession } from "@/lib/sessions.functions";

const STORAGE_KEY = "zia_session_id";

export function useSessionTracker() {
  const startFn = useServerFn(startMySession);
  const beatFn = useServerFn(heartbeatMySession);
  const endFn = useServerFn(endMySession);
  const idRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const ensureStart = async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) {
        startedRef.current = false;
        return;
      }
      try {
        const existing = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
        if (existing) {
          idRef.current = existing;
        } else {
          const res = await startFn({ data: { user_agent: navigator.userAgent.slice(0, 500) } });
          idRef.current = res.id;
          if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, res.id);
        }
      } catch {
        startedRef.current = false;
      }
    };

    const endNow = async (clearStore = true) => {
      const id = idRef.current;
      if (!id) return;
      idRef.current = null;
      startedRef.current = false;
      if (clearStore && typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
      try {
        await endFn({ data: { id } });
      } catch {}
    };

    ensureStart();

    const beat = () => {
      const id = idRef.current;
      if (!id || document.visibilityState !== "visible") return;
      beatFn({ data: { id } }).catch(() => {});
    };
    const interval = window.setInterval(beat, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        ensureStart().then(beat);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => {
      const id = idRef.current;
      if (!id) return;
      endFn({ data: { id } }).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        endNow(true);
      } else if (event === "SIGNED_IN") {
        ensureStart();
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      sub.subscription.unsubscribe();
      // Best-effort end on unmount (sign-out triggers explicit end above)
      endNow(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}