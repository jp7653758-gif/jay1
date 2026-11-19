import React, { useState } from 'react';
import { ArrowUpRight, Globe, Loader2, Search } from 'lucide-react';

interface SearchSource {
  title: string;
  uri: string;
}

interface SearchResult {
  query: string;
  answer: string;
  sources: SearchSource[];
}

const PRESET_QUERIES = [
  {
    label: 'USD to INR rate today',
    prompt: 'What is the current USD to INR exchange rate today?',
  },
  {
    label: 'Razorpay UPI limit India',
    prompt: 'What is the current UPI per-transaction limit in India on Razorpay?',
  },
  {
    label: 'Stripe global card currencies',
    prompt: 'Which international cards and currencies does Stripe support for global USD checkouts?',
  },
  {
    label: 'Browser direct-to-disk limits',
    prompt: 'How does Chrome File System Access API handle multi-gigabyte file downloads directly to disk?',
  },
] as const;

export function SearchGroundingPanel() {
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const runSearch = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setQueryInput(clean);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/search-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as SearchResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not retrieve live Google Search answer.');
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Search lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(queryInput);
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
      <div>
        <div className="inline-flex items-center gap-2 font-mono-num text-[11.5px] font-semibold text-blue-700 dark:text-blue-400">
          <Globe className="h-3.5 w-3.5" />
          <span>Live Google Search verification</span>
        </div>
        <h3 className="mt-1 font-display text-[20px] font-bold text-slate-900 dark:text-white">
          Look up live FX rates, Razorpay UPI limits, or browser transfer facts
        </h3>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESET_QUERIES.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={loading}
            onClick={() => void runSearch(preset.prompt)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-60"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <label htmlFor="live-search-input" className="sr-only">
          Search live payment rates or browser transfer facts
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          />
          <input
            id="live-search-input"
            type="text"
            maxLength={300}
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Ask about live USD/INR rate, Razorpay UPI, Stripe cards…"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-[14px] text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !queryInput.trim()}
          className="brand-cta min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            'Search Google →'
          )}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-[13px] text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-mono-num text-slate-500 dark:text-slate-400">
            <span>Grounded answer</span>
            <span>Google Search</span>
          </div>
          <div className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
            {result.answer}
          </div>
          {result.sources.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {result.sources.slice(0, 5).map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[12px] font-medium text-slate-900 dark:text-white hover:border-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <span className="max-w-[220px] truncate">{src.title}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
