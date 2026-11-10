/* Rainbow Om control panel — plain DOM, no dependencies.
 * Works with createOmControls: armor mode buttons, engines, shimmer.
 * Usage: var panel = createOmPanel(controller); panel.destroy(); */
(function (scope) {
  scope.createOmPanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};
    var modes = [
      { id: 'cruise', label: 'Крейсер' },
      { id: 'ram',    label: 'Таран' },
      { id: 'aft',    label: 'К корме' },
      { id: 'open',   label: 'Открыто' }
    ];
    var sliders = [
      { label: 'Перелив',   key: 'setShimmer', min: 0, max: 1,   step: 0.01, fmt: pct },
      { label: 'Перетекание', key: 'setFlow',  min: 0, max: 3,   step: 0.01, fmt: function (v) { return v.toFixed(2); } },
      { label: 'Цвет',      key: 'setHue',     min: 0, max: 6.28, step: 0.01, fmt: deg }
    ];
    function pct(v) { return Math.round(v * 100) + '%'; }
    function deg(v) { return Math.round(v * 57.3) + '\u00B0'; }
    var root = document.createElement('div');
    root.style.cssText = [
      'position:' + (opts.position || 'absolute'),
      'top:' + (opts.top != null ? opts.top : 12),
      'left:' + (opts.left != null ? opts.left : 12),
      'z-index:9999',
      'background:rgba(16,24,38,0.9)',
      'border:1px solid rgba(140,170,210,0.35)',
      'border-radius:10px',
      'padding:10px 12px 12px',
      'color:#e8eef8',
      'font:13px/1.45 system-ui,sans-serif',
      'min-width:236px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.45)',
      'user-select:none'
    ].join(';');
    var title = document.createElement('div');
    title.textContent = opts.title || 'Rainbow Om \u2014 броня';
    title.style.cssText = 'font-weight:600;margin-bottom:8px;cursor:pointer;';
    var body = document.createElement('div');
    root.appendChild(title); root.appendChild(body);

    /* armor mode buttons */
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    var buttons = {};
    modes.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.style.cssText = 'flex:1 1 46%;padding:6px 4px;border-radius:6px;cursor:pointer;' +
        'border:1px solid #3a4c66;background:#1a2637;color:#cfe0f2;font:12px system-ui,sans-serif;';
      b.addEventListener('click', function () {
        controller.setArmorMode(m.id);
        refresh();
      });
      buttons[m.id] = b;
      row.appendChild(b);
    });
    body.appendChild(row);

    /* engines toggle */
    var eng = document.createElement('label');
    eng.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 8px;cursor:pointer;';
    var engBox = document.createElement('input');
    engBox.type = 'checkbox'; engBox.checked = true;
    engBox.addEventListener('change', function () { controller.setEngines(engBox.checked); });
    var engText = document.createElement('span');
    engText.textContent = 'Двигатели';
    eng.appendChild(engBox); eng.appendChild(engText);
    body.appendChild(eng);

    /* sliders */
    sliders.forEach(function (s) {
      if (typeof controller[s.key] !== 'function') return;
      var line = document.createElement('label');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
      var name = document.createElement('span');
      name.textContent = s.label;
      name.style.cssText = 'flex:0 0 100px;color:#b9c7dc;';
      var input = document.createElement('input');
      input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step;
      input.value = opts.initial && opts.initial[s.key] != null ? opts.initial[s.key] : s.min;
      input.style.cssText = 'flex:1;min-width:70px;accent-color:#ffc76f;';
      var out = document.createElement('span');
      out.style.cssText = 'flex:0 0 46px;text-align:right;color:#ffe0a8;font-variant-numeric:tabular-nums;';
      function apply() {
        var v = parseFloat(input.value);
        controller[s.key](v);
        out.textContent = s.fmt(v);
      }
      input.addEventListener('input', apply);
      apply();
      line.appendChild(name); line.appendChild(input); line.appendChild(out);
      body.appendChild(line);
    });

    function refresh() {
      var cur = controller.getArmorMode ? controller.getArmorMode() : 'cruise';
      modes.forEach(function (m) {
        var on = m.id === cur;
        buttons[m.id].style.background = on ? '#4a3a1a' : '#1a2637';
        buttons[m.id].style.borderColor = on ? '#ffc76f' : '#3a4c66';
        buttons[m.id].style.color = on ? '#ffe0a8' : '#cfe0f2';
      });
    }
    refresh();

    var collapsed = false;
    title.addEventListener('click', function () {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : '';
    });
    (opts.parent || document.body).appendChild(root);
    return {
      element: root,
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
