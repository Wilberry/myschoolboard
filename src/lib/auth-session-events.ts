"use client";

export const SESSION_SIGN_OUT_EVENT = "myschoolboard:session-sign-out";
const SESSION_CHANNEL_NAME = "myschoolboard-session-events";

export function announceSessionSignOut() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_SIGN_OUT_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    channel.postMessage("sign-out");
    channel.close();
  }
}

export function listenForSessionSignOut(onSignOut: () => void) {
  if (typeof window === "undefined") return () => {};
  const handleSignOut = () => onSignOut();
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(SESSION_CHANNEL_NAME);
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.data === "sign-out") onSignOut();
  };
  window.addEventListener(SESSION_SIGN_OUT_EVENT, handleSignOut);
  channel?.addEventListener("message", handleMessage);
  return () => {
    window.removeEventListener(SESSION_SIGN_OUT_EVENT, handleSignOut);
    channel?.removeEventListener("message", handleMessage);
    channel?.close();
  };
}
