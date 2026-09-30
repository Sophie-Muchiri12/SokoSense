import { useCallback, useEffect, useRef, useState } from "react";
import { MARKET_PRICES_CACHE_MS } from "@/lib/config";
import {
  getMarketPrices,
  type MarketMapResponse,
} from "@/lib/sokosense-api";

interface CacheEntry {
  data: MarketMapResponse;
  fetchedAt: number;
}

const sessionCache = new Map<string, CacheEntry>();

export interface UseMarketPricesResult {
  data: MarketMapResponse | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  lastUpdated: Date | null;
  sourceDate: string | null;
  retry: () => void;
}

export function useMarketPrices(cropKey: string): UseMarketPricesResult {
  const [data, setData] = useState<MarketMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sourceDate, setSourceDate] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const key = cropKey.toLowerCase();
    const cached = sessionCache.get(key);
    const now = Date.now();

    if (cached && now - cached.fetchedAt < MARKET_PRICES_CACHE_MS) {
      setData(cached.data);
      setLastUpdated(new Date(cached.fetchedAt));
      setSourceDate(cached.data.date ?? null);
      setLoading(false);
      setError(null);
      setIsStale(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsStale(false);

    getMarketPrices(key)
      .then((response) => {
        if (cancelled || !mounted.current) return;
        sessionCache.set(key, { data: response, fetchedAt: Date.now() });
        setData(response);
        setLastUpdated(new Date());
        setSourceDate(response.date ?? null);
        setError(null);
        setIsStale(false);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load prices";
        if (cached) {
          setData(cached.data);
          setLastUpdated(new Date(cached.fetchedAt));
          setSourceDate(cached.data.date ?? null);
          setIsStale(true);
          setError(message);
        } else {
          setData(null);
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cropKey, tick]);

  return { data, loading, error, isStale, lastUpdated, sourceDate, retry };
}
