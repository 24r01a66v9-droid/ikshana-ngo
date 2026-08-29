export const buildAuthRequestInit = (init: RequestInit = {}): RequestInit => {
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("ikshana-auth-token")
    : null;
  const cookieToken = typeof window !== "undefined"
    ? document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("token="))
        ?.split("=")[1]
    : null;

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Ikshana-Token", token);
  } else if (cookieToken) {
    headers.set("Authorization", `Bearer ${cookieToken}`);
    headers.set("X-Ikshana-Token", cookieToken);
  }

  return {
    ...init,
    credentials: "include",
    headers,
  };
};
