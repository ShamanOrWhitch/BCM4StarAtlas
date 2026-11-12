/* Ship demo panel: discrete mechanical modes and quick actions only.
 * Engine intensity follows actual ship movement; manual numeric sliders are omitted.
 */
(function (scope) {
  scope.createFimbulMambaPanel = function (controller, opts) {
    if (!controller) throw new Error('controller required');
    opts = opts || {};

    var modes = [
      { id: 'pad',    label: 'Палуба' },
      { id: 'flight', label: 'Полёт' },
      { id: 'hunt',   label: 'Охота' },
      { id: 'load',   label: 'Погрузка' }
    ];

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
    title.textContent = opts.title || 'Fimbul Mamba \u2014 охотник за головами';
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

    var quick = document.createElement('div');
    quick.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px;';
    [['Шасси', function () {
        var on = controller.getLegs() > 0.5;
        controller.setLegs(on ? 0 : 1);
        refresh();
      }],
     ['Отсек', function () {
        var on = controller.getBay() > 0.5;
        controller.setBay(on ? 0 : 1);
        if (controller.setRamp) controller.setRamp(on ? 0 : 1);
        refresh();
      }],
     ['Трап', function () {
        var on = controller.getRamp() > 0.5;
        controller.setRamp(on ? 0 : 1);
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
      var st = controller.getState ? controller.getState() : {};
      state.textContent = 'режим ' + st.mode;    }
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
