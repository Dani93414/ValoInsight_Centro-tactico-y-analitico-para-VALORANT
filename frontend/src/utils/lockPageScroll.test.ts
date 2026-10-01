import { afterEach, describe, expect, it, vi } from "vitest";
import { lockPageScroll } from "./lockPageScroll";

afterEach(() => vi.unstubAllGlobals());

describe("lockPageScroll", () => {
  it.each([false, true])(
    "restores profile scrolling with overlapping modals (list closes first: %s)",
    (listClosesFirst) => {
      const html = { style: { overflow: "" } };
      const body = { style: { overflow: "auto" } };
      vi.stubGlobal("document", { documentElement: html, body });

      const closeList = lockPageScroll();
      const closePlayback = lockPageScroll();
      const closeFirst = listClosesFirst ? closeList : closePlayback;
      const closeLast = listClosesFirst ? closePlayback : closeList;
      closeFirst();
      expect(html.style.overflow).toBe("hidden");
      expect(body.style.overflow).toBe("hidden");
      closeLast();
      expect(html.style.overflow).toBe("");
      expect(body.style.overflow).toBe("auto");

      const closeReopened = lockPageScroll();
      closeLast();
      expect(body.style.overflow).toBe("hidden");
      closeReopened();
      expect(html.style.overflow).toBe("");
      expect(body.style.overflow).toBe("auto");
    },
  );
});
