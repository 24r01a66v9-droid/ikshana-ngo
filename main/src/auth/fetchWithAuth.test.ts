import { describe, expect, it, beforeEach } from "vitest";
import { buildAuthRequestInit } from "./fetchWithAuth";

describe("buildAuthRequestInit", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds bearer auth and include credentials when a token exists", () => {
    window.localStorage.setItem("ikshana-auth-token", "test-token");

    const init = buildAuthRequestInit({ method: "POST", body: "{}" });
    const headers = new Headers(init.headers);

    expect(init.credentials).toBe("include");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("X-Ikshana-Token")).toBe("test-token");
  });

  it("omits auth header when no token is stored", () => {
    const init = buildAuthRequestInit({ method: "GET" });
    const headers = new Headers(init.headers);

    expect(init.credentials).toBe("include");
    expect(headers.get("Authorization")).toBeNull();
  });
});
