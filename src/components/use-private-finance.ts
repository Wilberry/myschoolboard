"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listenForSessionSignOut } from "@/src/lib/auth-session-events";
export function usePrivateFinance<T>(url: string) {
  const [view, setView] = useState<T | null>(null),
    [message, setMessage] = useState("Checking financial access…");
  const panel = useRef<HTMLDivElement>(null),
    epoch = useRef(0),
    pending = useRef<AbortController | null>(null),
    ended = useRef(false),
    printPermit = useRef(false);
  const conceal = useCallback(
    (
      status = "Financial information concealed. Recheck access to continue.",
    ) => {
      ++epoch.current;
      pending.current?.abort();
      printPermit.current = false;
      if (panel.current) panel.current.hidden = true;
      setView(null);
      setMessage(status);
    },
    [],
  );
  const load = useCallback(
    async (concealFirst = true) => {
      if (
        ended.current ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      )
        return false;
      const current = ++epoch.current;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      if (concealFirst) {
        if (panel.current) panel.current.hidden = true;
        setView(null);
        setMessage("Rechecking financial access…");
      }
      const deadline = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw Error();
        if (
          current !== epoch.current ||
          controller.signal.aborted ||
          ended.current ||
          document.visibilityState !== "visible" ||
          !document.hasFocus()
        )
          return false;
        setView(data as T);
        if (panel.current) panel.current.hidden = false;
        setMessage("Current school financial records loaded.");
        return true;
      } catch {
        if (current === epoch.current)
          conceal(
            "Financial records unavailable. Your access or the school’s visibility policy may have changed.",
          );
        return false;
      } finally {
        clearTimeout(deadline);
      }
    },
    [url, conceal],
  );
  useEffect(() => {
    const hide = () => conceal(),
      refresh = () => {
        void load();
      },
      visibility = () =>
        document.visibilityState === "visible" ? refresh() : hide();
    const before = () => {
      if (!printPermit.current)
        conceal("Use Print records to verify access before printing.");
    };
    const after = () => conceal();
    const timer = setInterval(() => void load(false), 10000),
      initial = setTimeout(refresh, 0);
    const off = listenForSessionSignOut(() => {
      ended.current = true;
      hide();
    });
    window.addEventListener("blur", hide);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
      off();
      conceal();
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load, conceal]);
  const print = async () => {
    if (await load()) {
      const current = epoch.current;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            current === epoch.current &&
            !ended.current &&
            document.hasFocus() &&
            document.visibilityState === "visible"
          ) {
            printPermit.current = true;
            window.print();
          }
        }),
      );
    }
  };
  return { view, message, panel, load, print };
}
