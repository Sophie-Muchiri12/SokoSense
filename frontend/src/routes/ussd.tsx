import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  postUssd,
  USSD_SERVICE_CODE,
  type UssdResponse,
} from "@/lib/sokosense-api";

export const Route = createFileRoute("/ussd")({
  head: () => ({
    meta: [
      { title: "USSD Simulator — SokoSense" },
      {
        name: "description",
        content:
          "Live *384*543# USSD simulator — dial the shortcode, pick menu options, and fetch real market, timing and loan decisions from the backend.",
      },
      { property: "og:title", content: "USSD Simulator — SokoSense" },
      {
        property: "og:description",
        content: "Interactive feature-phone USSD simulator wired to the live SokoSense gateway.",
      },
    ],
  }),
  component: UssdPage,
});

type SessionStep = {
  input: string;
  response: UssdResponse;
  latencyMs: number;
};

const DEMO_PHONE = "+254712345678";

function newSessionId(): string {
  return crypto.randomUUID();
}

function UssdPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionText, setSessionText] = useState("");
  const [screenBody, setScreenBody] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSessionId(null);
    setSessionText("");
    setScreenBody(null);
    setSessionOpen(false);
    setCurrentInput("");
    setSteps([]);
    setLoading(false);
    setConnecting(false);
    setError(null);
    setLastLatencyMs(null);
  }, []);

  const invokeUssd = useCallback(
    async (text: string, inputLabel: string, overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId ?? newSessionId();
      setSessionId(sid);

      setLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const response = await postUssd({
          sessionId: sid,
          serviceCode: USSD_SERVICE_CODE,
          phoneNumber: DEMO_PHONE,
          text,
        });
        const latencyMs = Math.round(performance.now() - start);
        setLastLatencyMs(latencyMs);
        setSessionText(text);
        setScreenBody(response.body);
        setSessionOpen(response.kind === "CON");
        setSteps((prev) => [...prev, { input: inputLabel, response, latencyMs }]);
        setCurrentInput("");
        return response;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "USSD request failed — is the backend running on localhost:8000?",
        );
        throw err;
      } finally {
        setLoading(false);
        setConnecting(false);
      }
    },
    [sessionId],
  );

  const dial = async () => {
    if (loading || connecting) return;
    reset();
    setConnecting(true);
    await invokeUssd("", "(dial)", newSessionId());
  };

  const sendInput = async () => {
    if (!sessionOpen || loading || !currentInput.trim()) return;
    const next =
      sessionText === ""
        ? currentInput.trim()
        : `${sessionText}*${currentInput.trim()}`;
    await invokeUssd(next, currentInput.trim());
  };

  const appendDigit = (digit: string) => {
    if (!sessionOpen || loading) return;
    setCurrentInput((v) => (v + digit).slice(0, 12));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void sendInput();
  };

  const lastStep = steps[steps.length - 1];
  const sessionEnded = steps.length > 0 && lastStep?.response.kind === "END";

  return (
    <div className="mx-auto max-w-[1240px] min-w-0 px-5 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
      <header className="max-w-3xl">
        <p className="eyebrow">USSD simulator · {USSD_SERVICE_CODE}</p>
        <h1 className="display mt-4 text-[40px] sm:text-[56px] text-ink leading-[1.02]">
          Dial the code.
          <br />
          <span className="italic text-teal">Get a real decision.</span>
        </h1>
        <p className="mt-5 text-[14px] leading-relaxed text-steel">
          Same feature-phone flow as Safaricom USSD — wired to the live{" "}
          <code className="font-mono text-[13px] text-ink">POST /ussd</code> handler.
          Pick menu options and the market, timing and loan engines respond with real data.
        </p>
      </header>

      <div className="mt-12 grid lg:grid-cols-2 gap-6">
        {/* Phone */}
        <section className="card-surface p-5 sm:p-7 bg-ink text-paper flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow text-teal-glow">Feature phone</p>
              <h2 className="font-serif text-[22px] text-paper mt-2">
                {USSD_SERVICE_CODE}
              </h2>
            </div>
            <span
              className={`chip border-paper/20 ${
                sessionEnded
                  ? "text-paper/70"
                  : sessionOpen
                    ? "border-teal-glow/40 text-teal-glow"
                    : "text-paper/60"
              }`}
            >
              {connecting || loading
                ? "● connecting"
                : sessionEnded
                  ? "○ session ended"
                  : sessionOpen
                    ? "● live session"
                    : "○ idle"}
            </span>
          </div>

          {/* Nokia-style screen */}
          <div className="mt-6 mx-auto w-full max-w-[300px]">
            <div className="rounded-[32px] border-2 border-paper/15 bg-[#1a1f18] p-3 shadow-card">
              <div className="rounded-t-[20px] bg-[#0A1109] px-4 py-2 flex items-center justify-between text-[10px] text-paper/50">
                <span>Safaricom</span>
                <span className="tabular">21:14</span>
              </div>
              <div className="rounded-b-[20px] bg-[#C5D2A8] text-[#102610] font-mono p-4 min-h-[280px] text-[12.5px] leading-[1.65] whitespace-pre-wrap flex flex-col">
                <div className="flex-1">
                  {connecting && !screenBody ? (
                    <>
                      Connecting to SokoSense…
                      {"\n\n"}
                      Session establishing.
                    </>
                  ) : screenBody ? (
                    screenBody
                  ) : (
                    <>
                      Dial {USSD_SERVICE_CODE}
                      {"\n\n"}
                      Press the green call button to start a live USSD session.
                    </>
                  )}
                </div>
                <div className="mt-3 border-t border-[#102610]/20 pt-2 text-[10.5px] text-[#102610]/70 flex justify-between">
                  <span>Reply</span>
                  <span>Cancel</span>
                </div>
              </div>
            </div>

            {/* Keypad + input */}
            <div className="mt-5 space-y-3">
              <label className="block text-[10.5px] uppercase tracking-[0.14em] text-paper/50">
                Menu input
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id="ussd-input"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={!sessionOpen || loading}
                  placeholder={sessionOpen ? "e.g. 1" : "Dial first"}
                  inputMode="numeric"
                  className="flex-1 rounded-xl border border-paper/15 bg-[#0A1109] px-4 py-2.5 font-mono text-[14px] text-paper placeholder:text-paper/30 focus:border-teal-glow/50 focus:outline-none focus:ring-2 focus:ring-teal-glow/15 disabled:opacity-40"
                />
                <button
                  id="ussd-send-btn"
                  onClick={() => void sendInput()}
                  disabled={!sessionOpen || loading || !currentInput.trim()}
                  className="rounded-xl bg-teal px-4 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => (key === "*" || key === "#" ? undefined : appendDigit(key))}
                    disabled={!sessionOpen || loading || key === "*" || key === "#"}
                    className="rounded-lg border border-paper/10 bg-[#0A1109] py-2.5 font-mono text-[15px] text-paper hover:border-teal-glow/30 hover:bg-teal/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              id="ussd-dial-btn"
              onClick={() => void dial()}
              disabled={loading || connecting}
              className="rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-teal-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? "Connecting…" : `Dial ${USSD_SERVICE_CODE}`}
            </button>
            <button
              id="ussd-reset-btn"
              onClick={reset}
              disabled={loading && !screenBody}
              className="rounded-full border border-paper/20 bg-transparent px-4 py-2.5 text-[12.5px] font-medium text-paper hover:border-paper/40 disabled:opacity-50 transition-colors"
            >
              Cancel session
            </button>
            {lastLatencyMs !== null && (
              <span className="ml-auto text-[11px] text-paper/50 tabular">
                Last hop: {lastLatencyMs}ms
              </span>
            )}
          </div>

          {sessionText && (
            <p className="mt-4 text-[11px] text-paper/45 font-mono break-all">
              Session path: {sessionText || "(root)"}
            </p>
          )}
        </section>

        {/* Session log */}
        <section className="card-surface p-5 sm:p-7 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Session trace</p>
              <h2 className="font-serif text-[22px] text-ink mt-2">
                Live gateway hops
              </h2>
            </div>
            <span className="chip">{steps.length} hop{steps.length === 1 ? "" : "s"}</span>
          </div>

          {error ? (
            <div className="mt-8 flex-1 rounded-xl border border-rose/30 bg-rose/4 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-rose/80">
                Request failed
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{error}</p>
              <p className="mt-3 text-[12px] text-steel">
                Start the backend with{" "}
                <code className="font-mono text-ink">uvicorn main:app --port 8000</code>.
              </p>
            </div>
          ) : steps.length === 0 ? (
            <div className="mt-8 flex-1 rounded-xl border border-dashed border-fog bg-canvas/60 p-10 flex items-center justify-center text-center">
              <p className="text-[13px] text-mist max-w-xs">
                Dial the shortcode to open a session, then reply with menu numbers (e.g.{" "}
                <span className="font-mono text-steel">1</span> for English →{" "}
                <span className="font-mono text-steel">1</span> for market prices).
              </p>
            </div>
          ) : (
            <ol className="mt-6 space-y-4 flex-1 overflow-y-auto max-h-[520px] pr-1">
              {steps.map((step, i) => (
                <li
                  key={`${i}-${step.input}`}
                  className="rounded-xl border border-hairline bg-canvas/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10.5px] uppercase tracking-[0.14em] text-mist">
                      Hop {i + 1} · input{" "}
                      <span className="font-mono text-ink">{step.input}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          step.response.kind === "CON"
                            ? "bg-teal/10 text-teal"
                            : "bg-green-surface text-green-deep"
                        }`}
                      >
                        {step.response.kind}
                      </span>
                      <span className="text-[11px] tabular text-steel">
                        {step.latencyMs}ms
                      </span>
                    </div>
                  </div>
                  <pre className="mt-3 font-mono text-[12.5px] text-ink whitespace-pre-wrap leading-relaxed">
                    {step.response.body}
                  </pre>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 pt-5 border-t border-hairline">
            <p className="text-[11px] uppercase tracking-wider text-mist">Quick path</p>
            <p className="mt-2 text-[12.5px] text-steel leading-relaxed">
              Market price for maize in Nairobi: dial, then send{" "}
              <code className="font-mono text-ink bg-canvas px-1 rounded">1</code>,{" "}
              <code className="font-mono text-ink bg-canvas px-1 rounded">1</code>,{" "}
              <code className="font-mono text-ink bg-canvas px-1 rounded">1</code>,{" "}
              <code className="font-mono text-ink bg-canvas px-1 rounded">1</code>{" "}
              (English → Market → Maize → Nairobi).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
