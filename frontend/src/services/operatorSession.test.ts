import { describe, expect, it } from "vitest";

import { operatorSessionService } from "./operatorSession";

describe("operatorSessionService", () => {
  it("reports open access without requiring an operator token", async () => {
    const session = await operatorSessionService.status();

    expect(session.status).toBe("authenticated");
    expect(session.authenticated).toBe(true);
  });

  it("does not require a token for login compatibility", async () => {
    const session = await operatorSessionService.login("");

    expect(session.status).toBe("authenticated");
  });

  it("keeps legacy error mapping non-blocking", () => {
    expect(operatorSessionService.stateFromError(new Error("ignored"))).toBe("authenticated");
  });
});
