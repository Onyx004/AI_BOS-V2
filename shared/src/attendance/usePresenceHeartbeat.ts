import { useEffect } from "react";
import { authSessionChangedEvent, getStoredAuthSession } from "@shared/auth/auth-service";
import { sendPresenceHeartbeat } from "./attendance.api";

const heartbeatIntervalMs = 60_000;

/** While a user is signed in, pings the backend so it knows they are online; it auto checks them out after 2 hours without a ping. */
export function usePresenceHeartbeat() {
 useEffect(() => {
 const ping = () => {
 const session = getStoredAuthSession();
 if (!session || session.user.mustChangePassword) return;
 void sendPresenceHeartbeat().catch(() => undefined);
 };

 ping();
 const timer = window.setInterval(ping, heartbeatIntervalMs);
 const onVisible = () => {
 if (document.visibilityState === "visible") ping();
 };
 document.addEventListener("visibilitychange", onVisible);
 window.addEventListener("online", ping);
 window.addEventListener(authSessionChangedEvent, ping);

 return () => {
 window.clearInterval(timer);
 document.removeEventListener("visibilitychange", onVisible);
 window.removeEventListener("online", ping);
 window.removeEventListener(authSessionChangedEvent, ping);
 };
 }, []);
}
