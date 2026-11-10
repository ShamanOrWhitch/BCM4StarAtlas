/* Rainbow Phi control panel — plain DOM, no dependencies.
 * Modes of the light levitation, engine toggle, photoli sliders,
 * camouflage + metal tint + render path (CPU / shader). */
(function (scope) {
  scope.createPhiPanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};
    var modes = [
      { id: 'cruise',     label: 'Крейсер' },
      { id: 'levitation', label: 'Левитация' },
      { id: 'shield',     label: 'Щит' },
      { id: 'iris',       label: 'Ирис' },
      { id: 'dismantle',  label: 'Разборка' }
    ];
    var sliders = [
      { label: 'Хамелеон',  key: 'setChameleon',  min: 0, max: 1,    step: 0.01, fmt: pct },
      { label: 'Маскировка', key: 'setCamouflage', min: 0, max: 1,   step: 0.01, fmt: pct },
      { label: 'Металл',    key: 'setMetalTint',  min: 0, max: 1,    step: 0.01, fmt: pct },
      { label: 'Серебро',   key: 'setSilver',     min: 0, max: 1,    step: 0.01, fmt: pct },
      { label: 'Левитация', key: 'setLevitation', min: 0, max: 1,    step: 0.01, fmt: pct },
      { label: 'Перетекание', key: 'setFlow',     min: 0, max: 3,    step: 0.01, fmt: function (v) { return v.toFixed(2); } },
      { label: 'Цвет',      key: 'setHue',        min: 0, max: 6.28, step: 0.01, fmt: deg }
    ];
    function pct(v) { return Math.round(v * 100) + '%'; }
    function deg(v) { return Math.round(v * 57.3) + '\u00B0'; }

    var root = document.createElement('div');
    root.style.cssText = [
      'position:' + (opts.position || 'absolute'),
      'top:' + (opts.top != null ? opts.top : 12),
      'left:' + (opts.left != null ? opts.left : 12),
      'z-index:9999',
      'background:rgba(14,20,30,0.92)',
      'border:1px solid rgba(180,150,90,0.35)',
      'border-radius:10px',
      'padding:10px 12px 12px',
      'color:#e8eef8',
      'font:13px/1.45 system-ui,sans-serif',
      'min-width:246px',
      'max-height:calc(100% - 24px)',
      'overflow:auto',
      'box-shadow:0 6px 24px rgba(0,0,0,0.5)',
      'user-select:none'
    ].join(';');
    var title = document.createElement('div');
    title.textContent = opts.title || 'Rainbow Phi \u2014 Titan';
    title.style.cssText = 'font-weight:600;margin-bottom:8px;cursor:pointer;';
    var body = document.createElement('div');
    root.appendChild(title); root.appendChild(body);

    /* mode buttons */
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    var buttons = {};
    modes.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.style.cssText = 'flex:1 1 44%;padding:6px 4px;border-radius:6px;cursor:pointer;' +
        'border:1px solid #4a3f28;background:#1d2230;color:#d8c9a8;font:12px system-ui,sans-serif;';
      b.addEventListener('click', function () { controller.setMode(m.id); refresh(); });
      buttons[m.id] = b;
      row.appendChild(b);
    });
    body.appendChild(row);

    /* engines + shader toggles */
    function checkbox(labelText, checked, onChange) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;';
      var box = document.createElement('input');
      box.type = 'checkbox'; box.checked = !!checked;
      box.addEventListener('change', function () { onChange(box.checked); });
      var sp = document.createElement('span');
      sp.textContent = labelText;
      lab.appendChild(box); lab.appendChild(sp);
      return lab;
    }
    body.appendChild(checkbox('Двигатели', true, function (v) { controller.setEngines(v); }));
    body.appendChild(checkbox('Шейдерный режим (GPU)', false, function (v) { controller.setShaderMode(v); }));

    /* sliders */
    sliders.forEach(function (s) {
      if (typeof controller[s.key] !== 'function') return;
      var getter = 'get' + s.key.slice(3);
      var line = document.createElement('label');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
      var name = document.createElement('span');
      name.textContent = s.label;
      name.style.cssText = 'flex:0 0 104px;color:#b9c7dc;';
      var input = document.createElement('input');
      input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step;
      var start = opts.initial && opts.initial[s.key] != null ? opts.initial[s.key]
        : (typeof controller[getter] === 'function' ? controller[getter]() : s.min);
      input.value = start;
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
      var cur = controller.getMode ? controller.getMode() : 'flight';
      modes.forEach(function (m) {
        var on = m.id === cur;
        buttons[m.id].style.background = on ? '#3d3418' : '#1d2230';
        buttons[m.id].style.borderColor = on ? '#ffc76f' : '#4a3f28';
        buttons[m.id].style.color = on ? '#ffe6b4' : '#d8c9a8';
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
