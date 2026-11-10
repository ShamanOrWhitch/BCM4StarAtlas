/* Armstrong IMP Tap — панель управления. Чистый DOM, без зависимостей.
 * Режимы, ползунки лап / барабанов / тяги / прожекторов, двигатели,
 * шейдерный режим. Работает и на слабом Android: ничего не перерисовывается,
 * кроме чисел. */
(function (scope) {
  scope.createImpTapPanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};

    var modes = [
      { id: 'landed',  label: 'Посадка' },
      { id: 'mining',  label: 'Добыча' },
      { id: 'flight',  label: 'Полёт' },
      { id: 'transit', label: 'Переход' }
    ];
    var sliders = [
      { label: 'Лапы',        key: 'setLegs',       min: 0, max: 1,   step: 0.01, fmt: pct },
      { label: 'Барабаны',    key: 'setDrillSpeed', min: 0, max: 2.5, step: 0.05, fmt: mult },
      { label: 'Тяга',        key: 'setThrust',     min: 0, max: 1,   step: 0.01, fmt: pct },
      { label: 'Прожекторы',  key: 'setLights',     min: 0, max: 1,   step: 0.01, fmt: pct }
    ];
    function pct(v) { return Math.round(v * 100) + '%'; }
    function mult(v) { return v.toFixed(2) + '\u00D7'; }

    var box = document.createElement('div');
    box.style.cssText = [
      'position:' + (opts.position || 'absolute'),
      'top:' + (opts.top != null ? opts.top : 12) + 'px',
      'left:' + (opts.left != null ? opts.left : 12) + 'px',
      'z-index:9999',
      'background:rgba(14,18,26,0.93)',
      'border:1px solid rgba(196,140,60,0.42)',
      'border-radius:10px',
      'padding:10px 12px 12px',
      'color:#eceff5',
      'font:13px/1.45 system-ui,sans-serif',
      'min-width:250px',
      'max-height:calc(100% - 24px)',
      'overflow:auto',
      'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
      'user-select:none'
    ].join(';');

    var title = document.createElement('div');
    title.textContent = opts.title || 'Armstrong IMP Tap \u2014 средний шахтёр';
    title.style.cssText = 'font-weight:600;margin-bottom:8px;cursor:pointer;';
    var body = document.createElement('div');
    box.appendChild(title);
    box.appendChild(body);

    /* ---- режимы ---- */
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    var buttons = {};
    modes.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.style.cssText = 'flex:1 1 44%;padding:6px 4px;border-radius:6px;cursor:pointer;' +
        'border:1px solid #4a3f28;background:#1d2230;color:#e2d3b4;font:12px system-ui,sans-serif;';
      b.addEventListener('click', function () { controller.setMode(m.id); refresh(); });
      buttons[m.id] = b;
      row.appendChild(b);
    });
    body.appendChild(row);

    /* ---- чекбоксы ---- */
    function checkbox(labelText, checked, onChange) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!checked;
      box.addEventListener('change', function () { onChange(box.checked); });
      var sp = document.createElement('span');
      sp.textContent = labelText;
      lab.appendChild(box);
      lab.appendChild(sp);
      return lab;
    }
    body.appendChild(checkbox('Двигатели', true, function (v) {
      controller.setEngines(v);
    }));
    body.appendChild(checkbox('Шейдерный режим (GPU)', false, function (v) {
      controller.setShaderMode(v);
    }));

    /* ---- ползунки ---- */
    sliders.forEach(function (s) {
      if (typeof controller[s.key] !== 'function') return;
      var line = document.createElement('label');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
      var name = document.createElement('span');
      name.textContent = s.label;
      name.style.cssText = 'flex:0 0 96px;color:#bcc8da;';
      var input = document.createElement('input');
      input.type = 'range';
      input.min = s.min;
      input.max = s.max;
      input.step = s.step;
      input.value = s.min;
      input.style.cssText = 'flex:1;min-width:70px;accent-color:#ffb14a;';
      var out = document.createElement('span');
      out.style.cssText = 'flex:0 0 48px;text-align:right;color:#ffd39a;font-variant-numeric:tabular-nums;';
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
        var getter = 'get' + s.key.slice(3);
        if (typeof controller[getter] === 'function') {
          var v = controller[getter]();
          input.value = v;
          out.textContent = s.fmt(v);
        }
      };
    });

    var state = document.createElement('div');
    state.style.cssText = 'margin-top:8px;color:#8fa0b8;font-size:11.5px;line-height:1.4;';
    body.appendChild(state);

    function refresh() {
      var cur = controller.getMode ? controller.getMode() : 'landed';
      modes.forEach(function (m) {
        var on = m.id === cur;
        buttons[m.id].style.background = on ? '#3f3218' : '#1d2230';
        buttons[m.id].style.borderColor = on ? '#ffb14a' : '#4a3f28';
        buttons[m.id].style.color = on ? '#ffe3b0' : '#e2d3b4';
      });
      sliders.forEach(function (s) { if (s.sync) s.sync(); });
      var st = controller.getState ? controller.getState() : {};
      state.textContent = 'режим ' + st.mode + ' \u00B7 лапы ' + pct(st.legs || 0) +
        ' \u00B7 барабаны ' + mult(st.drills || 0) + ' \u00B7 тяга ' + pct(st.thrust || 0) +
        (st.shader ? ' \u00B7 GPU' : ' \u00B7 CPU');
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
