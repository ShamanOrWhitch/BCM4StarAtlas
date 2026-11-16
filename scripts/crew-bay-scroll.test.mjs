// BUG-010: on a short screen the crew page is h-dvh and overflow hidden.
// The filter stack and the wallet ship list were shrink-0 with no scroller,
// so everything below them was clipped. The column must be height-bounded,
// the stack above the cards must scroll, and the card list must scroll.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bay = readFileSync(new URL("../src/components/crew/bay.tsx", import.meta.url), "utf8");

test("BUG-010: the crew column scrolls on a small screen instead of clipping the list", () => {
  const section = bay.slice(bay.indexOf("<section"), bay.indexOf("</section>"));
  assert.match(section, /<section className="[^"]*min-h-0[^"]*overflow-hidden/, "the crew column is not height-bounded, so overflow-y-auto never scrolls");
  assert.match(section, /max-h-\[46%\][^"]*overflow-y-auto/, "the filter and wallet-ship stack cannot scroll, so the cards stay below the fold");
  assert.match(section, /min-h-0 flex-1 overflow-y-auto/, "the crew card list does not scroll");
});
