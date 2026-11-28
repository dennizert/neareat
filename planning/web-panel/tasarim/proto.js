/* Eatlas web prototipi — yalnızca gösterim davranışları.
   Üretimde bu dosyanın KARŞILIĞI: tema anahtarı, çekmece, sekme, dialog.
   API çağrısı yoktur. */
(function () {
  var root = document.documentElement;
  var KEY = 'eatlas-theme';

  // --- Tema: kayıtlı seçim > sistem tercihi ---
  try { var saved = localStorage.getItem(KEY); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function syncThemeButtons() {
    var dark = currentTheme() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Açık temaya geç' : 'Koyu temaya geç');
      b.title = b.getAttribute('aria-label');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncThemeButtons();

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme-toggle]');
      if (t) {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY, next); } catch (err) {}
        syncThemeButtons();
        return;
      }

      // --- Çekmece (mobil yan menü) ---
      var app = document.querySelector('.app');
      if (e.target.closest('[data-drawer-open]') && app) {
        app.setAttribute('data-drawer', 'open');
        var first = document.querySelector('.sidebar .nav-link');
        if (first) first.focus();
        return;
      }
      if (e.target.closest('[data-drawer-close]') && app) {
        app.removeAttribute('data-drawer');
        var mb = document.querySelector('[data-drawer-open]');
        if (mb) mb.focus();
        return;
      }

      // --- Dialog aç / kapat ---
      var opener = e.target.closest('[data-dialog-open]');
      if (opener) {
        var d = document.getElementById(opener.getAttribute('data-dialog-open'));
        if (d && d.showModal) {
          d.querySelectorAll('[data-fill]').forEach(function (el) {
            var v = opener.getAttribute('data-' + el.getAttribute('data-fill'));
            if (v == null) return;
            if ('value' in el && el.tagName !== 'DD') el.value = v; else el.textContent = v;
          });
          d.showModal();
        }
        return;
      }
      var closer = e.target.closest('[data-dialog-close]');
      if (closer) { var dlg = closer.closest('dialog'); if (dlg) dlg.close(); return; }

      // --- Sekmeler (role=tablist) ---
      var tab = e.target.closest('[role="tab"]');
      if (tab) {
        var list = tab.closest('[role="tablist"]');
        list.querySelectorAll('[role="tab"]').forEach(function (x) {
          var on = x === tab;
          x.setAttribute('aria-selected', String(on));
          x.tabIndex = on ? 0 : -1;
          var p = document.getElementById(x.getAttribute('aria-controls'));
          if (p) p.hidden = !on;
        });
        var filter = tab.getAttribute('data-filter');
        if (filter != null) {
          document.querySelectorAll('[data-status-row]').forEach(function (r) {
            r.hidden = filter !== 'ALL' && r.getAttribute('data-status-row') !== filter;
          });
        }
        return;
      }

      // --- Prototip durum çubuğu ---
      var ps = e.target.closest('[data-proto-show]');
      if (ps) {
        var group = ps.getAttribute('data-proto-group');
        document.querySelectorAll('[data-proto-group="' + group + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === ps)); });
        document.querySelectorAll('[data-proto-state="' + group + '"]').forEach(function (el) {
          el.hidden = el.getAttribute('data-proto-id') !== ps.getAttribute('data-proto-show');
        });
      }
    });

    // Sekmelerde ok tuşu gezinmesi
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { var app = document.querySelector('.app[data-drawer="open"]'); if (app) app.removeAttribute('data-drawer'); }
      var tab = e.target.closest && e.target.closest('[role="tab"]');
      if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var tabs = Array.prototype.slice.call(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
      var i = tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = tabs[(i + tabs.length) % tabs.length];
      next.focus(); next.click();
    });

    // Şifre göster/gizle
    document.querySelectorAll('[data-toggle-password]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById(b.getAttribute('data-toggle-password'));
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(show));
        b.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
      });
    });
  });
})();
