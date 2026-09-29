(function () {
  var THEME_KEY = "nsbm-rec-theme";

  function applyTheme(theme) {
    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }

  window.recTheme = {
    get: function () {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    },
    toggle: function () {
      var next = window.recTheme.get() === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) { }
      return next;
    },
  };

  window.recUi = {
    prefersReducedMotion: function () {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },

    /** Locks page scroll while a modal is open and reports Escape presses to .NET. */
    openModal: function (dotnetRef) {
      var previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      var onKeyDown = function (e) {
        if (e.key === "Escape") dotnetRef.invokeMethodAsync("OnEscape");
      };
      window.addEventListener("keydown", onKeyDown);
      return {
        close: function () {
          document.body.style.overflow = previousOverflow;
          window.removeEventListener("keydown", onKeyDown);
        },
      };
    },

    closeModal: function (handle) {
      if (handle) handle.close();
    },

    focus: function (element) {
      if (element) element.focus();
    },

    resetForm: function (id) {
      var form = document.getElementById(id);
      if (form) form.reset();
    },
  };
})();
