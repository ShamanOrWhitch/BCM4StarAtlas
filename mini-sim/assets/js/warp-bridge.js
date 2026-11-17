/* BCM4SA Warp bridge — selected SAGE destination and committed local location are separate. */
(function (window) {
  "use strict";
  function finiteCoordinate(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function copyNode(node) {
    if (!node || typeof node !== "object" || !node.id) return null;
    return { id: String(node.id), name: String(node.name || node.id),
      x: finiteCoordinate(node.x), y: finiteCoordinate(node.y) };
  }
  function copyLocation(place, node) {
    if (!place || typeof place !== "object" || !place.id) return null;
    const result = { id: String(place.id), label: String(place.label || place.id) };
    const sectorX = finiteCoordinate(place.sectorX), sectorY = finiteCoordinate(place.sectorY);
    if (sectorX !== null) result.sectorX = sectorX;
    if (sectorY !== null) result.sectorY = sectorY;
    const galaxyNode = copyNode(node || place.galaxyNode);
    if (galaxyNode) result.galaxyNode = galaxyNode;
    return result;
  }
  function create(options) {
    const config = options || {};
    let destination = null, currentLocation = null;
    function notifyLocation() {
      if (typeof config.onCurrentLocationChange === "function") {
        config.onCurrentLocationChange(copyLocation(currentLocation));
      }
    }
    return Object.freeze({
      previewDestination(node) {
        // Hover previews are snapshots only. They never write either route state.
        const preview = copyNode(node);
        if (preview && node.raw && typeof node.raw === "object") preview.raw = node.raw;
        return preview;
      },
      selectDestination(node) {
        const selected = copyNode(node);
        if (!selected) return null;
        destination = selected;
        return copyNode(destination);
      },
      getDestination() { return copyNode(destination); },
      clearDestination() { destination = null; return null; },
      commitArrival(place, node) {
        if (!place || !place.id) throw new Error("Warp bridge cannot commit an empty location");
        currentLocation = copyLocation(place, node || destination);
        if (!currentLocation) throw new Error("Warp bridge received an invalid arrival location");
        notifyLocation();
        return copyLocation(currentLocation);
      },
      setCurrentLocation(place, node) {
        currentLocation = copyLocation(place, node || destination);
        notifyLocation();
        return copyLocation(currentLocation);
      },
      getCurrentLocation() { return copyLocation(currentLocation); },
      clearCurrentLocation() { currentLocation = null; notifyLocation(); return null; },
      snapshot() { return { destination: copyNode(destination), currentLocation: copyLocation(currentLocation) }; }
    });
  }
  window.BCMWarpBridge = Object.freeze({ create });
})(window);
