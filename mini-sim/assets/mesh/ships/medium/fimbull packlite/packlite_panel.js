/* Fimbul BYOS Packlite — панель управления грузовиком-баржей. Чистый DOM,
 * без зависимостей. Режимы палуба / полёт / охота / погрузка, ползунки лыж,
 * турелей, створок грузового люка, тяги, стробоскопов и прожекторов,
 * двигатели и шейдерный режим. На слабом Android обновляются только числа. */
(function (scope) {
  scope.createPacklitePanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};

    var modes = [
      { id: 'pad',    label: 'Палуба' },
      { id: 'flight', label: 'Полёт' },
      { id: 'hunt',   label: 'Охота' },
      { id: 'load',   label: 'Погрузка' }
    ];
    var sliders = [
      { label: 'Лыжи',      key: 'setLegs',   min: 0, max: 1, step: 0.01, fmt: pct },
      { label: 'Турели',    key: 'setGuns',   min: 0, max: 1, step: 0.01, fmt: deg(16) },
      { label: 'Люк трюма', key: 'setLid',    min: 0, max: 1, step: 0.01, fmt: deg(82) },
      { label: 'Тяга',      key: 'setThrust', min: 0, max: 1, step: 0.01, fmt: pct },
      { label: 'Стробоскоп', key: 'setStrobe', min: 0, max: 1, step: 0.01, fmt: pct },
      { label: 'Прожекторы', key: 'setSpots', min: 0, max: 1, step: 0.01, fmt: pct }
    ];
    function pct(v) { return Math.round(v * 100) + '%'; }
    function deg(full) { return function (v) { return Math.round(v * full) + '\u00B0'; }; }
    function m(full) { return function (v) { return (v * full).toFixed(1) + ' м'; }; }

    var box = document.createElement('div');
    box.style.cssText = [
      'position:' + (opts.position || 'absolute'),
      'top:' + (opts.top != null ? opts.top : 12) + 'px',
      'left:' + (opts.left != null ? opts.left : 12) + 'px',
      'z-index:9999',
      'background:rgba(13,17,24,0.93)',
      'border:1px solid rgba(150,165,190,0.35)',
      'border-radius:10px',
      'padding:10px 12px 12px',
      'color:#eef1f6',
      'font:13px/1.45 system-ui,sans-serif',
      'min-width:252px',
      'max-height:calc(100% - 24px)',
      'overflow:auto',
      'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
      'user-select:none'
    ].join(';');

    var title = document.createElement('div');
    title.textContent = opts.title || 'Fimbul BYOS Packlite \u2014 грузовик-баржа';
    title.style.cssText = 'font-weight:600;margin-bottom:8px;cursor:pointer;';
    var body = document.createElement('div');
    box.appendChild(title);
    box.appendChild(body);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    var buttons = {};
    modes.forEach(function (mo) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = mo.label;
      b.style.cssText = 'flex:1 1 44%;padding:6px 4px;border-radius:6px;cursor:pointer;' +
        'border:1px solid #39424f;background:#1a212b;color:#d7dee8;font:12px system-ui,sans-serif;';
      b.addEventListener('click', function () { controller.setMode(mo.id); refresh(); });
      buttons[mo.id] = b;
      row.appendChild(b);
    });
    body.appendChild(row);

    function checkbox(labelText, checked, onChange) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!checked;
      cb.addEventListener('change', function () { onChange(cb.checked); });
      var sp = document.createElement('span');
      sp.textContent = labelText;
      lab.appendChild(cb);
      lab.appendChild(sp);
      return lab;
    }
    var quick = document.createElement('div');
    quick.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px;';
    [['Шасси', function () {
        var on = controller.getLegs() > 0.5;
        controller.setLegs(on ? 0 : 1);
        refresh();
      }],
     ['Люк трюма', function () {
        var on = controller.getLid() > 0.5;
        controller.setLid(on ? 0 : 1);
        refresh();
      }]].forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q[0];
      b.style.cssText = 'flex:1 1 30%;padding:6px 3px;border-radius:6px;cursor:pointer;' +
        'border:1px solid #4c5b3a;background:#22301f;color:#dfeccd;' +
        'font:11.5px system-ui,sans-serif;';
      b.addEventListener('click', q[1]);
      quick.appendChild(b);
    });
    body.appendChild(quick);
    body.appendChild(checkbox('Двигатели', true, function (v) { controller.setEngines(v); }));
    body.appendChild(checkbox('Шейдерный режим (GPU)', false, function (v) {
      controller.setShaderMode(v);
    }));

    sliders.forEach(function (s) {
      if (typeof controller[s.key] !== 'function') return;
      var line = document.createElement('label');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
      var name = document.createElement('span');
      name.textContent = s.label;
      name.style.cssText = 'flex:0 0 86px;color:#b7c3d4;';
      var input = document.createElement('input');
      input.type = 'range';
      input.min = s.min;
      input.max = s.max;
      input.step = s.step;
      var getter = 'get' + s.key.slice(3);
      input.value = typeof controller[getter] === 'function' ? controller[getter]() : s.min;
      input.style.cssText = 'flex:1;min-width:66px;accent-color:#7fb2e8;';
      var out = document.createElement('span');
      out.style.cssText = 'flex:0 0 44px;text-align:right;color:#cfe2f8;font-variant-numeric:tabular-nums;';
      function apply() {
        var v = parseFloat(input.value);
        controller[s.key](v);
        out.textContent = s.fmt(v);
      }
      input.addEventListener('input', apply);
      out.textContent = s.fmt(parseFloat(input.value));
      line.appendChild(name);
      line.appendChild(input);
      line.appendChild(out);
      body.appendChild(line);
      s.sync = function () {
        if (typeof controller[getter] === 'function') {
          var v = controller[getter]();
          input.value = v;
          out.textContent = s.fmt(v);
        }
      };
    });

    var state = document.createElement('div');
    state.style.cssText = 'margin-top:8px;color:#8a99ae;font-size:11.5px;line-height:1.4;';
    body.appendChild(state);

    function refresh() {
      var cur = controller.getMode ? controller.getMode() : 'pad';
      modes.forEach(function (mo) {
        var on = mo.id === cur;
        buttons[mo.id].style.background = on ? '#2f3d4d' : '#1a212b';
        buttons[mo.id].style.borderColor = on ? '#7fb2e8' : '#39424f';
        buttons[mo.id].style.color = on ? '#e8f2ff' : '#d7dee8';
      });
      sliders.forEach(function (s) { if (s.sync) s.sync(); });
      var st = controller.getState ? controller.getState() : {};
      state.textContent = 'режим ' + st.mode + ' \u00B7 лыжи ' + pct(st.legs || 0) +
        ' \u00B7 турели ' + pct(st.guns || 0) +
        ' \u00B7 люк трюма ' + pct(st.lid || 0) +
        ' \u00B7 тяга ' + pct(st.thrust || 0) + (st.shader ? ' \u00B7 GPU' : ' \u00B7 CPU');
    }
    refresh();

    var collapsed = false;
    title.addEventListener('click', function () {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : '';
    });

    (opts.parent || document.body).appendChild(box);
    return {
      element: box,
      refresh: refresh,
      destroy: function () { if (box.parentNode) box.parentNode.removeChild(box); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
