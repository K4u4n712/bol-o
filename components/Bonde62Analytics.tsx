import { useEffect } from "react";
import { Platform } from "react-native";

const ANALYTICS_URL =
  "https://bol-o-rouge.vercel.app/api/analytics-bonde62";

function randomId() {
  return `b62_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function getVisitorId() {
  if (Platform.OS !== "web") {
    return randomId();
  }

  try {
    const key = "bonde62_visitor_id";
    let value = window.localStorage.getItem(key);

    if (!value) {
      value = randomId();
      window.localStorage.setItem(key, value);
    }

    return value;
  } catch {
    return randomId();
  }
}

function pagePath() {
  if (Platform.OS === "web") {
    return window.location.pathname || "/bonde62";
  }

  return "/bonde62";
}

async function send(
  visitorId: string,
  action: "page_view" | "heartbeat" | "leave"
) {
  const payload = {
    visitorId,
    action,
    path: pagePath(),
    referrer:
      Platform.OS === "web"
        ? document.referrer || ""
        : "",
    userAgent:
      Platform.OS === "web"
        ? navigator.userAgent || ""
        : "",
    platform: Platform.OS,
  };

  try {
    await fetch(ANALYTICS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      ...(Platform.OS === "web"
        ? ({ keepalive: true } as any)
        : {}),
    });
  } catch {
    // Analytics nunca deve bloquear o site.
  }
}

export default function Bonde62Analytics() {
  useEffect(() => {
    const visitorId = getVisitorId();

    send(visitorId, "page_view");

    const heartbeat = setInterval(() => {
      send(visitorId, "heartbeat");
    }, 15_000);

    let onVisibility: (() => void) | undefined;
    let onBeforeUnload: (() => void) | undefined;

    if (Platform.OS === "web") {
      onVisibility = () => {
        if (document.visibilityState === "visible") {
          send(visitorId, "heartbeat");
        } else {
          send(visitorId, "leave");
        }
      };

      onBeforeUnload = () => {
        send(visitorId, "leave");
      };

      document.addEventListener(
        "visibilitychange",
        onVisibility
      );
      window.addEventListener(
        "beforeunload",
        onBeforeUnload
      );
    }

    return () => {
      clearInterval(heartbeat);
      send(visitorId, "leave");

      if (
        Platform.OS === "web" &&
        onVisibility &&
        onBeforeUnload
      ) {
        document.removeEventListener(
          "visibilitychange",
          onVisibility
        );
        window.removeEventListener(
          "beforeunload",
          onBeforeUnload
        );
      }
    };
  }, []);

  return null;
}