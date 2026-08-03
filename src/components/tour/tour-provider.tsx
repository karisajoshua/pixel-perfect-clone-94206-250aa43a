import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTourProgress, saveTourProgress } from "@/lib/tour.functions";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/components/tour/tour-steps";

type TourContextValue = {
  start: () => void;
  stop: () => void;
  running: boolean;
};

const TourContext = createContext<TourContextValue>({ start: () => {}, stop: () => {}, running: false });
export const useTour = () => useContext(TourContext);

const localKey = (tourId: string) => `tour-status:${tourId}`;

type Rect = { top: number; left: number; width: number; height: number };

function useElementRect(selector: string | undefined, stepIndex: number) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const started = Date.now();
    setRect(null);
    setSettled(false);
    if (!selector) {
      setSettled(true);
      return;
    }
    let scrolled = false;
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        setSettled(true);
      } else if (Date.now() - started > 2500) {
        // Target never appeared (hidden on this screen size / not permitted).
        setRect(null);
        setSettled(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [selector, stepIndex]);

  return { rect, settled };
}

function Spotlight({
  steps,
  index,
  onNext,
  onBack,
  onSkip,
}: {
  steps: TourStep[];
  index: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const step = steps[index]!;
  const { rect } = useElementRect(step.selector, index);
  const pad = 8;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      if (e.key === "ArrowLeft") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip]);

  const isLast = index === steps.length - 1;

  const card = (
    <div className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-card text-card-foreground shadow-2xl p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Step {index + 1} of {steps.length}
          </div>
          <div className="mt-1 text-sm font-semibold">{step.title}</div>
        </div>
        <button onClick={onSkip} aria-label="Close tour" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground">
          Skip tour
        </button>
        <div className="ml-auto flex gap-2">
          {index > 0 && (
            <Button size="sm" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );

  if (!rect) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 grid place-items-center p-4">{card}</div>
    );
  }

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const below = rect.top + rect.height + 12;
  const placeBelow = below + 200 < vh;
  const cardTop = placeBelow ? below : Math.max(12, rect.top - 212);
  const cardLeft = Math.min(Math.max(12, rect.left), Math.max(12, vw - 340));

  return (
    <>
      {/* click shield */}
      <div className="fixed inset-0 z-[9998]" onClick={onSkip} />
      <div
        className="fixed z-[9998] rounded-lg pointer-events-none ring-2 ring-primary transition-all duration-200"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
        }}
      />
      <div className="fixed z-[9999]" style={{ top: cardTop, left: cardLeft }} onClick={(e) => e.stopPropagation()}>
        {card}
      </div>
    </>
  );
}

export function TourProvider({
  tourId,
  steps,
  roles,
  enabled = true,
  children,
}: {
  tourId: string;
  steps: TourStep[];
  roles?: string[];
  enabled?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadProgress = useServerFn(getTourProgress);
  const persist = useServerFn(saveTourProgress);

  const [phase, setPhase] = useState<"idle" | "welcome" | "running">("idle");
  const [index, setIndex] = useState(0);
  const askedRef = useRef(false);

  const visibleSteps = useMemo(
    () => steps.filter((s) => !s.roles || s.roles.some((r) => (roles ?? []).includes(r))),
    [steps, roles],
  );

  const record = useCallback(
    (status: "in_progress" | "skipped" | "completed", lastStep = 0) => {
      try {
        localStorage.setItem(localKey(tourId), status);
      } catch {
        /* storage unavailable */
      }
      void persist({ data: { tourId, status, lastStep } }).catch(() => {});
    },
    [persist, tourId],
  );

  // Decide whether to offer the tour on first load.
  useEffect(() => {
    if (!enabled || askedRef.current) return;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(localKey(tourId));
    } catch {
      cached = null;
    }
    if (cached === "completed" || cached === "skipped") {
      askedRef.current = true;
      return;
    }
    askedRef.current = true;
    void loadProgress()
      .then((rows) => {
        const row = (rows ?? []).find((r) => r.tour_id === tourId);
        if (row && (row.status === "completed" || row.status === "skipped")) {
          try {
            localStorage.setItem(localKey(tourId), row.status);
          } catch {
            /* ignore */
          }
          return;
        }
        setPhase("welcome");
      })
      .catch(() => {});
  }, [enabled, loadProgress, tourId]);

  const goTo = useCallback(
    (next: number) => {
      const step = visibleSteps[next];
      if (!step) return;
      setIndex(next);
      record("in_progress", next);
      if (step.path && step.path !== pathname) navigate({ to: step.path });
    },
    [visibleSteps, navigate, pathname, record],
  );

  const start = useCallback(() => {
    setPhase("running");
    setIndex(0);
    const first = visibleSteps[0];
    record("in_progress", 0);
    if (first?.path && first.path !== pathname) navigate({ to: first.path });
  }, [visibleSteps, navigate, pathname, record]);

  const stop = useCallback(() => {
    setPhase("idle");
    record("skipped", index);
  }, [record, index]);

  const finish = useCallback(() => {
    setPhase("idle");
    record("completed", visibleSteps.length);
  }, [record, visibleSteps.length]);

  const value = useMemo<TourContextValue>(
    () => ({ start, stop, running: phase === "running" }),
    [start, stop, phase],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {phase === "welcome" && (
        <div className="fixed inset-0 z-[9999] bg-black/60 grid place-items-center p-4">
          <div className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-card text-card-foreground shadow-2xl p-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
              <Compass className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Welcome aboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Take a quick guided tour and we'll show you exactly where to click — from onboarding a client all
              the way to issuing a policy. It takes about two minutes.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={start}>Start the tour</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPhase("idle");
                  record("skipped", 0);
                }}
              >
                No thanks, I know my way around
              </Button>
            </div>
          </div>
        </div>
      )}
      {phase === "running" && visibleSteps.length > 0 && (
        <Spotlight
          steps={visibleSteps}
          index={Math.min(index, visibleSteps.length - 1)}
          onNext={() => (index >= visibleSteps.length - 1 ? finish() : goTo(index + 1))}
          onBack={() => goTo(Math.max(0, index - 1))}
          onSkip={stop}
        />
      )}
    </TourContext.Provider>
  );
}

export function TourRestartButton({ className, label = "Take the tour" }: { className?: string; label?: string }) {
  const { start } = useTour();
  return (
    <button
      type="button"
      onClick={start}
      className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", className)}
    >
      <Compass className="h-4 w-4" />
      {label}
    </button>
  );
}