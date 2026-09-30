import { useCallback, useEffect, useState } from "react";

import { SokoSenseLogo } from "./sokosense-logo";

const STORAGE_KEY = "sokosense-welcome-seen";
const AUTO_DISMISS_MS = 4500;

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setExiting(true);
    window.setTimeout(() => setVisible(false), 600);
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const frame = window.requestAnimationFrame(() => setEntered(true));
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center overflow-hidden transition-opacity duration-600 ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to SokoSense"
    >
      <div className="absolute inset-0 bg-canvas" aria-hidden="true" />
      <div className="splash-bg-orb splash-bg-orb-a" aria-hidden="true" />
      <div className="splash-bg-orb splash-bg-orb-b" aria-hidden="true" />

      <div
        className={`relative mx-auto max-w-lg px-6 text-center transition-all duration-600 ${
          exiting ? "translate-y-3 scale-[0.97] opacity-0" : entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0"
        }`}
      >
        <div className="flex justify-center splash-rise">
          <SokoSenseLogo size="xl" variant="plain" animate />
        </div>

        <p className="eyebrow mt-10 splash-rise splash-rise-delay-1">Welcome</p>
        <h1 className="display mt-4 text-[36px] sm:text-[44px] text-ink splash-rise splash-rise-delay-2">
          Agricultural intelligence
          <br />
          <span className="italic text-teal">for East Africa.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-steel splash-rise splash-rise-delay-3">
          Real-time market prices, AI advisory and credit scoring — built for farmers, SACCOs and
          agribusinesses across the region.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-10 rounded-full bg-teal px-8 py-3.5 text-[13px] font-medium text-paper transition hover:bg-teal-soft splash-rise splash-rise-delay-4"
        >
          Enter SokoSense
        </button>

        <p className="mt-6 text-[11px] text-mist splash-rise splash-rise-delay-5">
          Markets · Credit · Advice · at the speed of SMS
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-6 pb-8" aria-hidden="true">
        <div className="mx-auto h-0.5 max-w-xs overflow-hidden rounded-full bg-hairline">
          <div className="h-full origin-left rounded-full bg-teal splash-progress-bar" />
        </div>
      </div>
    </div>
  );
}
