/**
 * G1000 Softkey LVars
 * Community add-on for MSFS 2024 (also loads on 2020 NXi if the plugin host accepts it).
 *
 * Reads the Working Title / Asobo G1000 NXi softkey bar and publishes the current
 * label as numeric LVars. MSFS LVars cannot hold strings, so each label is a
 * stable dictionary code plus a hash and a packed character form. Any tool that
 * can read LVars (SPAD.neXt, MobiFlight, FSUIPC, AxisAndOhs, Air Manager) can
 * branch on the code without the AxisAndOhs G1000 Bridge.
 *
 * Loaded as a global avionics plugin from html_ui/Plugins. The script also starts
 * a DOM poller as soon as it runs, so labels are published even if the instrument
 * rejects the plugin class.
 */
(function () {
  'use strict';

  var KEYS = 12;
  var POLL_MS = 200;
  var HEARTBEAT_MS = 1000;

  // Stable codes for the labels a hardware profile actually branches on.
  // 0 is reserved for empty / not in the dictionary. Unknown text still
  // publishes HASH and TXT0/TXT1.
  var LABEL_CODES = {
    '': 0,
    'INSET': 1,
    'OFF': 2,
    'DCLTR': 3,
    'DCLTR-1': 4,
    'DCLTR-2': 5,
    'DCLTR-3': 6,
    'WX': 7,
    'LX': 8,
    'TOPO': 9,
    'TERRAIN': 10,
    'TRAFFIC': 11,
    'BACK': 12,
    'ALERTS': 13,
    'MESSAGE': 14,
    'NRST': 15,
    'STRMSCP': 16,
    'NEXRAD': 17,
    'XM LTNG': 18,
    'LTNG': 19,
    'METAR': 20,
    'AIRMET': 21,
    'SIGMET': 22,
    'PIREP': 23,
    'WINDS': 24,
    'LEGEND': 25,
    'BRG1': 26,
    'BRG2': 27,
    'ALT UNIT': 28,
    'STD BARO': 29,
    'BARO': 30,
    'CDI': 31,
    'OBS': 32,
    'SUSP': 33,
    'XPDR': 34,
    'IDENT': 35,
    'BKSP': 36,
    'VFR': 37,
    'CODE': 38,
    'STBY': 39,
    'ON': 40,
    'ALT': 41,
    'GND': 42,
    '0': 43,
    '1': 44,
    '2': 45,
    '3': 46,
    '4': 47,
    '5': 48,
    '6': 49,
    '7': 50,
    'ENGINE': 51,
    'LEAN': 52,
    'SYSTEM': 53,
    'CYL SLCT': 54,
    'ASSIST': 55,
    'DEC FUEL': 56,
    'INC FUEL': 57,
    'RST FUEL': 58,
    'ADF/DME': 59,
    'BRG': 60,
    'DME': 61,
    'XPDR1': 62,
    'XPDR2': 63,
    'MAP': 64,
    'TRAFFIC-MAP': 65,
    'HSI MAP': 66,
    'PFD': 67,
    'MAP OPT': 68,
    'DETAIL': 69,
    'AUTO': 70,
    'SMALL': 71,
    'MED': 72,
    'LARGE': 73,
    'FULL': 74,
    'NORTH UP': 75,
    'TRACK UP': 76,
    'DTK UP': 77,
    'HDG UP': 78,
    'RANGE': 79,
    'WIND': 80,
    'OPT 1': 81,
    'OPT 2': 82,
    'OPT 3': 83,
    'SVT': 84,
    'PATHWAY': 85,
    'SYN TERR': 86,
    'HRZN HDG': 87,
    'APT SIGNS': 88,
    'TFC': 89,
    'TAWS': 90,
    'FLC': 91,
    'VNAV': 92,
    'GP': 93,
    'TIMER': 94,
    'REFS': 95,
    'MENU': 96,
    'ENT': 97,
    'CHKLIST': 98,
    'DONE': 99,
    'EXIT': 100,
    'EMERGCY': 101,
    'NORM': 102,
    'PREV': 103,
    'NEXT': 104,
    'GROUP': 105,
    'PAGE': 106,
    'CHART': 107,
    'INFO': 108,
    'SELECT': 109,
    'LOAD': 110,
    'ACTIVATE': 111,
    'REMOVE': 112,
    'FPL': 113,
    'CNCL': 114,
    'DIRECT': 115,
    'DTO': 116,
    'WPT': 117,
    'PROC': 118,
    'VNAV': 119,
    'OBS MODE': 120,
    'INH': 121,
    'INHIBIT': 122,
    'TEST': 123,
    'ADC1': 124,
    'ADC2': 125,
    'AHRS1': 126,
    'AHRS2': 127,
    'GPS1': 128,
    'GPS2': 129,
    'SENSORS': 130,
    'OTHER': 131,
    'PFD OPT': 132,
    'MFD OPT': 133,
    'SYN VIS': 134,
    'TER': 135,
    'PROFILE': 136,
    'PAN MAP': 137,
    'MEASURE': 138,
    'USER WPT': 139,
    'AIRWAYS': 140,
    'CHARTS': 141,
    'SHW CHRT': 142,
    'HIDE': 143,
    'ALL': 144,
    'CLEAR': 145,
    'ACCEPT': 146,
    'REJECT': 147,
    'SET': 148,
    'SYNC': 149,
    'HDG SYNC': 150
  };

  var last = {};
  var started = false;

  function fnv1a(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pack4(text, offset) {
    var n = 0;
    var mul = 1;
    for (var i = 0; i < 4; i++) {
      var c = offset + i < text.length ? text.charCodeAt(offset + i) : 0;
      if (c > 127) c = 63;
      n += c * mul;
      mul *= 128;
    }
    return n;
  }

  function setL(name, value) {
    if (last[name] === value) return;
    last[name] = value;
    try {
      if (typeof SimVar !== 'undefined' && SimVar.SetSimVarValue) {
        SimVar.SetSimVarValue('L:' + name, 'number', value);
      }
    } catch (e) {}
  }

  function detectUnit() {
    var href = '';
    var title = '';
    try { href = String(location && location.href || ''); } catch (e) {}
    try { title = String(document && document.title || ''); } catch (e) {}
    var blob = (href + ' ' + title).toUpperCase();
    var side = blob.indexOf('MFD') >= 0 ? 'MFD' : 'PFD';
    var index = 1;
    var m = href.match(/[?&]Index=(\d+)/i);
    if (m) index = parseInt(m[1], 10) || 1;
    return { side: side, index: index };
  }

  function textOf(node) {
    if (!node) return '';
    var label = node.querySelector('[class*="label"], [class*="Label"]');
    var raw = (label ? label.textContent : node.textContent) || '';
    return raw.replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function flag(node, pattern) {
    if (!node) return false;
    var cls = (node.className && String(node.className)) || '';
    if (pattern.test(cls)) return true;
    var child = node.querySelector('[class*="indicator"], [class*="Indicator"], [class*="highlight"]');
    if (!child) return false;
    var ccls = String(child.className || '');
    if (/green|active|on|highlight/i.test(ccls)) return true;
    var style = '';
    try { style = child.getAttribute('style') || ''; } catch (e) {}
    return /green|#0f0|rgb\(\s*0\s*,\s*255/i.test(style);
  }

  function readDom() {
    var nodes = [];
    try {
      nodes = Array.prototype.slice.call(document.querySelectorAll(
        '.softkeys-container > .softkey-tab, .SoftKeys > .softkey-tab'
      ));
      if (!nodes.length) {
        nodes = Array.prototype.slice.call(document.querySelectorAll('.softkey-tab'));
      }
    } catch (e) {
      return [];
    }
    var tops = nodes.filter(function (n) {
      return !nodes.some(function (other) { return other !== n && other.contains(n); });
    });
    tops = tops.map(function (n) {
      var box = { left: 0, top: 0 };
      try { box = n.getBoundingClientRect(); } catch (e) {}
      return { node: n, left: box.left || 0, top: box.top || 0 };
    });
    if (tops.length > KEYS) {
      var bottom = tops.reduce(function (max, item) {
        return item.top > max ? item.top : max;
      }, 0);
      var row = tops.filter(function (item) { return Math.abs(item.top - bottom) < 8; });
      tops = row.length >= KEYS ? row : tops;
    }
    tops.sort(function (a, b) { return a.left - b.left; });
    if (tops.length > KEYS) tops = tops.slice(0, KEYS);
    var out = [];
    for (var i = 0; i < KEYS; i++) {
      var node = tops[i] && tops[i].node;
      var label = node ? textOf(node) : '';
      var disabled = node ? /text-disabled|disabled|grey|gray/i.test(String(node.className || '')) : true;
      var ind = 0;
      if (node && flag(node, /highlighted|indicating/i)) ind = 2;
      else if (node && flag(node, /indicating-dim/i)) ind = 1;
      out.push({ label: label, enabled: node ? (disabled ? 0 : 1) : 0, ind: ind });
    }
    return out;
  }

  function readMenu(menuSystem) {
    if (!menuSystem) return null;
    var menu = menuSystem.currentMenu || menuSystem.activeMenu || menuSystem.menu;
    if (!menu && menuSystem.menuStack && menuSystem.menuStack.length) {
      menu = menuSystem.menuStack[menuSystem.menuStack.length - 1];
    }
    if (!menu || typeof menu.getItem !== 'function') return null;
    var out = [];
    for (var i = 0; i < KEYS; i++) {
      var item = null;
      try { item = menu.getItem(i); } catch (e) {}
      var label = '';
      var enabled = 0;
      var ind = 0;
      if (item) {
        var raw = item.label;
        if (raw && typeof raw.get === 'function') label = String(raw.get() || '');
        else if (typeof raw === 'string') label = raw;
        label = label.replace(/\s+/g, ' ').trim().toUpperCase();
        var dis = item.disabled;
        if (dis && typeof dis.get === 'function') enabled = dis.get() ? 0 : 1;
        else enabled = dis ? 0 : 1;
        var hi = item.highlighted;
        if (hi && typeof hi.get === 'function' && hi.get()) ind = 2;
        else if (item.value && typeof item.value.get === 'function' && item.value.get()) ind = 2;
        if (!label) enabled = 0;
      }
      out.push({ label: label, enabled: enabled, ind: ind });
    }
    return out;
  }

  function publish(unit, keys) {
    if (!keys || !keys.length) return;
    var prefix = 'G1000_' + unit.side + unit.index + '_SK';
    var alias = unit.index === 1 ? 'G1000_' + unit.side + '_SK' : null;
    for (var i = 0; i < KEYS; i++) {
      var k = keys[i] || { label: '', enabled: 0, ind: 0 };
      var label = k.label || '';
      var code = Object.prototype.hasOwnProperty.call(LABEL_CODES, label) ? LABEL_CODES[label] : 0;
      var hash = label ? fnv1a(label) : 0;
      var n = i + 1;
      var names = [prefix + n];
      if (alias) names.push(alias + n);
      for (var p = 0; p < names.length; p++) {
        var base = names[p];
        setL(base + '_CODE', code);
        setL(base + '_HASH', hash);
        setL(base + '_EN', k.enabled ? 1 : 0);
        setL(base + '_IND', k.ind || 0);
        setL(base + '_TXT0', pack4(label, 0));
        setL(base + '_TXT1', pack4(label, 4));
      }
    }
    setL('G1000_SK_BRIDGE', 1);
    setL('G1000_' + unit.side + unit.index + '_SK_ALIVE', 1);
  }

  function boot(menuSystem) {
    if (started) return;
    started = true;
    var unit = detectUnit();
    var tick = 0;
    setL('G1000_SK_BRIDGE', 1);

    function frame() {
      var fromMenu = readMenu(menuSystem);
      var keys = fromMenu || readDom();
      publish(unit, keys);
    }

    frame();
    setInterval(frame, POLL_MS);
    setInterval(function () {
      tick = (tick + 1) % 1000000;
      setL('G1000_SK_BRIDGE_TICK', tick);
    }, HEARTBEAT_MS);
  }

  function Plugin(binder) {
    this.binder = binder || {};
  }
  Plugin.prototype.onInstalled = function () {
    if (this.binder && this.binder.menuSystem) menuRef = this.binder.menuSystem;
    boot(menuRef);
  };
  Plugin.prototype.onMenuSystemInitialized = function () {
    menuRef = (this.binder && this.binder.menuSystem) || menuRef;
    if (!started) boot(menuRef);
  };

  var menuRef = null;
  var _readMenu = readMenu;
  readMenu = function () {
    return _readMenu(menuRef);
  };

  function register() {
    var sdk = window.msfssdk || window.garminsdk || window.msfsSdk || null;
    if (sdk && typeof sdk.registerPlugin === 'function') {
      if (sdk.AvionicsPlugin) {
        var Bound = function (binder) {
          sdk.AvionicsPlugin.call(this, binder);
          Plugin.call(this, binder);
        };
        Bound.prototype = Object.create(sdk.AvionicsPlugin.prototype);
        Bound.prototype.constructor = Bound;
        Bound.prototype.onInstalled = Plugin.prototype.onInstalled;
        Bound.prototype.onMenuSystemInitialized = Plugin.prototype.onMenuSystemInitialized;
        sdk.registerPlugin(Bound);
        return;
      }
      sdk.registerPlugin(Plugin);
      return;
    }
    if (typeof registerPlugin === 'function') {
      registerPlugin(Plugin);
    }
  }

  try { register(); } catch (e) {}
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { boot(null); });
    } else {
      setTimeout(function () { boot(null); }, 500);
    }
  }
})();
