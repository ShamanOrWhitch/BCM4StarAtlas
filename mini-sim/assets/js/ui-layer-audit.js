(() => {
  "use strict";

  if (window.BCMUILayerAudit) return;

  const TARGETS = [
    ".bcm-mini-sim button",
    ".bcm-mini-sim input",
    ".bcm-mini-sim select",
    ".bcm-mini-sim textarea",
    ".bcm-warp-hull-enter",
    ".bcm-warp-ring-enter",
    "#bcm-hull-dive button",
    "#bcm-ring-platformer button",
    "#bcm-ring-transition button",
    ".bcm-comic-dialogs button",
    ".bcm-tower button"
  ].join(", ");
  const PANEL_ID = "bcm-ui-layer-audit-panel";
  let panel = null;
  let lastReport = [];

  function describe(node) {
    if (!node || node.nodeType !== 1) return "(no element)";
    if (node.id) return "#" + node.id;
    const role = node.getAttribute("role");
    const data = [...node.attributes].find((attribute) => attribute.name.startsWith("data-"));
    const className = typeof node.className === "string"
      ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".")
      : "";
    const classPart = className ? "." + className : "";
    const dataPart = data ? "[" + data.name + '="' + String(data.value).slice(0, 36) + '"]' : "";
    return node.tagName.toLowerCase() + classPart + dataPart + (role ? '[role="' + role + '"]' : "");
  }

  function visible(element) {
    if (!element || !element.isConnected || element.closest("[hidden]")) return false;
    if (element.closest("#" + PANEL_ID)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right <= Math.max(0, rect.left) || bottom <= Math.max(0, rect.top)) return false;
    let current = element;
    while (current && current.nodeType === 1) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.035) {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  }

  function samplePoints(rect) {
    const left = Math.max(0, rect.left + 1);
    const top = Math.max(0, rect.top + 1);
    const right = Math.min(window.innerWidth - 1, rect.right - 1);
    const bottom = Math.min(window.innerHeight - 1, rect.bottom - 1);
    if (right < left || bottom < top) return [];
    const x1 = left + (right - left) * 0.25;
    const x2 = left + (right - left) * 0.75;
    const y1 = top + (bottom - top) * 0.25;
    const y2 = top + (bottom - top) * 0.75;
    return [
      { x: (left + right) / 2, y: (top + bottom) / 2 },
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x1, y: y2 },
      { x: x2, y: y2 }
    ];
  }

  function inspect(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const label = String(
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.innerText ||
      element.value ||
      element.getAttribute("data-control") ||
      element.getAttribute("data-ring-action") ||
      element.getAttribute("data-hull-control") ||
      element.tagName
    ).replace(/\s+/g, " ").trim().slice(0, 80);
    const record = {
      element: describe(element),
      label,
      status: "ok",
      reachablePoints: 0,
      sampledPoints: 0,
      blocker: "",
      pointerEvents: style.pointerEvents,
      zIndex: style.zIndex,
      bounds: [
        Math.round(rect.left), Math.round(rect.top),
        Math.round(rect.width), Math.round(rect.height)
      ].join(",")
    };

    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      record.status = "disabled";
      return record;
    }
    if (style.pointerEvents === "none") {
      record.status = "pointer-events-none";
      record.blocker = "The target itself has pointer-events:none";
      return record;
    }

    const points = samplePoints(rect);
    record.sampledPoints = points.length;
    const blockers = new Map();
    for (const point of points) {
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit && (hit === element || element.contains(hit))) {
        record.reachablePoints += 1;
      } else if (hit) {
        const key = describe(hit);
        blockers.set(key, (blockers.get(key) || 0) + 1);
      }
    }
    if (!record.reachablePoints) {
      record.status = "occluded";
      record.blocker = [...blockers.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => name + " (" + count + "/" + points.length + ")")
        .join(", ") || "No hit-test target at button coordinates";
    } else if (record.reachablePoints < points.length) {
      record.status = "partially-covered";
      record.blocker = [...blockers.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => name + " (" + count + "/" + points.length + ")")
        .join(", ");
    }
    return record;
  }

  function scan() {
    const wasHidden = panel ? panel.hidden : true;
    const oldDisplay = panel ? panel.style.display : "";
    if (panel) {
      panel.hidden = true;
      panel.style.display = "none";
    }
    try {
      const elements = [...new Set(document.querySelectorAll(TARGETS))].filter(visible);
      lastReport = elements.map(inspect);
    } finally {
      if (panel) {
        panel.style.display = oldDisplay;
        panel.hidden = wasHidden;
      }
    }
    return {
      total: lastReport.length,
      ok: lastReport.filter((item) => item.status === "ok").length,
      occluded: lastReport.filter((item) => item.status === "occluded").length,
      partial: lastReport.filter((item) => item.status === "partially-covered").length,
      nonHitTestable: lastReport.filter((item) => item.status === "pointer-events-none").length,
      controls: lastReport.map((item) => ({ ...item })),
      failures: lastReport.filter((item) => item.status !== "ok" && item.status !== "disabled")
    };
  }

  function renderReport() {
    const result = scan();
    const output = panel.querySelector("[data-layer-audit-output]");
    const summary = panel.querySelector("[data-layer-audit-summary]");
    const failed = result.failures;
    summary.textContent = result.total + " visible controls · " +
      result.ok + " reachable · " + failed.length + " warning(s)";
    if (!failed.length) {
      output.textContent = "All visible interactive controls received hit-tests at their sampled points.";
    } else {
      output.textContent = failed.map((item) =>
        item.status.toUpperCase() + " · " + item.label + "\n" +
        item.element + " · blocker: " + (item.blocker || "unknown") +
        "\nsize " + item.bounds + " · z-index " + item.zIndex
      ).join("\n\n");
    }
    if (window.console && typeof console.table === "function") {
      console.table(failed.length ? failed : lastReport);
    }
    return result;
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return panel;
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute("aria-label", "UI layer hit-test diagnostics");
    panel.style.cssText = "position:fixed;left:10px;bottom:10px;width:min(440px,calc(100vw - 20px));max-height:min(62vh,520px);overflow:auto;z-index:2147483647;padding:12px;border:1px solid #82dce8;border-radius:10px;background:rgba(3,12,21,.97);color:#eefaff;font:12px/1.45 ui-monospace,Consolas,monospace;box-shadow:0 8px 36px rgba(0,0,0,.55);pointer-events:auto";
    panel.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<strong style="font:700 13px/1.3 system-ui,sans-serif">UI LAYER CHECK</strong>' +
        '<button type="button" data-layer-audit-close style="min-height:32px;padding:4px 10px;border:1px solid #527486;border-radius:6px;background:#132d3c;color:#fff">Close</button>' +
      '</div>' +
      '<div data-layer-audit-summary style="margin-bottom:8px;color:#b8e9f2"></div>' +
      '<button type="button" data-layer-audit-rescan style="min-height:34px;padding:6px 10px;border:1px solid #6ccedc;border-radius:6px;background:#12404c;color:#fff;margin-bottom:9px">Scan again</button>' +
      '<pre data-layer-audit-output style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0;color:#e5f4f8"></pre>';
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-layer-audit-close]")) panel.hidden = true;
      if (event.target.closest("[data-layer-audit-rescan]")) renderReport();
    });
    document.body.appendChild(panel);
    return panel;
  }

  function open() {
    ensurePanel();
    panel.hidden = false;
    renderReport();
    return lastReport;
  }

  function toggle() {
    ensurePanel();
    if (panel.hidden) open();
    else panel.hidden = true;
  }

  window.BCMUILayerAudit = {
    scan,
    open,
    toggle,
    getLastReport: () => lastReport.map((item) => ({ ...item }))
  };

  window.addEventListener("keydown", (event) => {
    if (event.repeat || !event.ctrlKey || !event.altKey || event.code !== "KeyU") return;
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }, true);
})();