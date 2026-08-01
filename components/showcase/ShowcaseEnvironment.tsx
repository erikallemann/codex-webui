"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SWRConfig } from "swr";
import { AppShell } from "@/components/layout/AppShell";
import { ShowcaseModeProvider } from "./showcase-context";
import { ActiveSessionProvider } from "@/stores/active-session";
import { useReplayStream } from "@/hooks/useReplayStream";
import {
  createShowcaseFetch,
  SHOWCASE_DEFAULT_SESSION_ID,
} from "@/lib/showcase/fixtures";

function ShowcaseBootstrap() {
  const { replay } = useReplayStream();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void replay(SHOWCASE_DEFAULT_SESSION_ID);
  }, [replay]);

  return null;
}

export function ShowcaseEnvironment() {
  const [ready, setReady] = useState(false);
  const cache = useMemo(() => new Map(), []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = createShowcaseFetch(originalFetch);
    setReady(true);
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!ready) {
    return <div className="h-screen w-screen bg-background" aria-label="Loading showcase" />;
  }

  return (
    <ShowcaseModeProvider>
      <SWRConfig value={{ provider: () => cache }}>
        <ActiveSessionProvider>
          <ShowcaseBootstrap />
          <AppShell />
        </ActiveSessionProvider>
      </SWRConfig>
    </ShowcaseModeProvider>
  );
}
