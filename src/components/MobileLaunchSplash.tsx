import { useEffect, useState } from "react";
import logo from "@/assets/zia-logo-white.png.asset.json";

const DURATION_MS = 1750;

/** One launch animation per browser tab; never replay on route changes. */
export function MobileLaunchSplash() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;
    if (window.sessionStorage.getItem("zest-launch-shown") === "1") return;
    window.sessionStorage.setItem("zest-launch-shown", "1");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVisible(true);
    const exit = window.setTimeout(() => setExiting(true), DURATION_MS - 350);
    const remove = window.setTimeout(() => setVisible(false), DURATION_MS);
    return () => { window.clearTimeout(exit); window.clearTimeout(remove); };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`zest-launch-splash ${exiting ? "zest-launch-exit" : ""}`}
      aria-label="Launching Zest Insurance"
      role="status"
    >
      <div className="zest-launch-halo" aria-hidden="true" />
      <img
        className="zest-launch-logo"
        src={logo.url}
        alt="Zest Insurance Agency"
        width={240}
        height={120}
        fetchPriority="high"
      />
      <div className="zest-launch-shimmer" aria-hidden="true" />
    </div>
  );
}
