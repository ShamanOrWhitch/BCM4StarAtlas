/* Photoli control panel — plain DOM, no dependencies, works with both
 * createPhotoliShader and createPhotoliLite controllers.
 * Usage: var panel = createPhotoliPanel(controller); panel.destroy(); */
(function (scope) {
  scope.createPhotoliPanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};
    var rows = [
      { label: 'Форма',         key: 'setMorph',        min: 0, max: 1,   step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } },
      { label: 'Активность',    key: 'setActivity',     min: 0, max: 1,   step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } },
      { label: 'Цвет',          key: 'setHue',          min: 0, max: 6.28, step: 0.01, fmt: function (v) { return Math.round(v * 57.3) + '\u00B0'; } },
      { label: 'Перетекание',   key: 'setFlow',         min: 0, max: 3,   step: 0.01, fmt: function (v) { return v.toFixed(2); } },
      { label: 'Сила перелива', key: 'setIridescence',  min: 0, max: 1,   step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } },
      { label: 'Блик',          key: 'setGloss',        min: 0, max: 1,   step: 0.01, fmt: function (v) { return Math.round(v * 100) + '%'; } }
    ];
    var css = [
      'position:' + (opts.position || 'absolute'),
      'top:' + (opts.top != null ? opts.top : 12),
      'left:' + (opts.left != null ? opts.left : 12),
      'z-index:9999',
      'background:rgba(16,24,38,0.88)',
      'border:1px solid rgba(140,170,210,0.35)',
      'border-radius:10px',
      'padding:10px 12px 12px',
      'color:#e8eef8',
      'font:13px/1.45 system-ui,sans-serif',
      'min-width:230px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.45)',
      'user-select:none'
    ].join(';');
    var root = document.createElement('div');
    root.style.cssText = css;
    var title = document.createElement('div');
    title.textContent = opts.title || 'Photoli \u2014 управление';
    title.style.cssText = 'font-weight:600;letter-spacing:0.02em;margin-bottom:8px;cursor:pointer;';
    var body = document.createElement('div');
    root.appendChild(title); root.appendChild(body);
    var sliders = [];
    rows.forEach(function (r) {
      if (typeof controller[r.key] !== 'function') return; // controller lacks this option
      var line = document.createElement('label');
      line.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;';
      var name = document.createElement('span');
      name.textContent = r.label;
      name.style.cssText = 'flex:0 0 100px;color:#b9c7dc;';
      var input = document.createElement('input');
      input.type = 'range'; input.min = r.min; input.max = r.max; input.step = r.step;
      input.value = opts.initial && opts.initial[r.key] != null ? opts.initial[r.key] : r.min;
      input.style.cssText = 'flex:1;min-width:70px;accent-color:#6fd0ff;';
      var out = document.createElement('span');
      out.style.cssText = 'flex:0 0 46px;text-align:right;color:#9fe0ff;font-variant-numeric:tabular-nums;';
      function apply() {
        var v = parseFloat(input.value);
        controller[r.key](v);
        out.textContent = r.fmt(v);
      }
      input.addEventListener('input', apply);
      apply();
      line.appendChild(name); line.appendChild(input); line.appendChild(out);
      body.appendChild(line);
      sliders.push({ input: input, apply: apply });
    });
    var collapsed = false;
    title.addEventListener('click', function () {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : '';
    });
    (opts.parent || document.body).appendChild(root);
    return {
      element: root,
      set: function (key, value) {
        sliders.forEach(function (s) { if (s.input.dataset.key === key) { s.input.value = value; s.apply(); } });
      },
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
