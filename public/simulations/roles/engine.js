// Click-through simulation engine. Each page sets window.SIM = { lang, scenes }.
// A scene: { title, text, tip, screen } — screen is app HTML in which one
// element carries data-hot="<label>"; tapping it advances. No data-hot →
// a "Next" button advances.
(function () {
  "use strict";
  var S = window.SIM, L = S.lang === "en"
    ? { step: "Step", of: "of", back: "← Back", next: "Next →", restart: "↺ Start again", tap: "Tap the highlighted element on the phone", done: "Done!", doneText: "That's the whole flow for this role." }
    : { step: "Крок", of: "з", back: "← Назад", next: "Далі →", restart: "↺ Почати знову", tap: "Натисніть підсвічений елемент на телефоні", done: "Готово!", doneText: "Це весь шлях для цієї ролі." };
  var app = document.getElementById("app"), title = document.getElementById("title"), text = document.getElementById("text"),
    tip = document.getElementById("tip"), count = document.getElementById("count"), bar = document.getElementById("bar"),
    prev = document.getElementById("prev"), next = document.getElementById("next"), list = document.getElementById("list");
  var i = 0;
  prev.textContent = L.back;
  S.scenes.forEach(function (sc, k) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.innerHTML = '<span class="n">' + (k + 1) + "</span><span></span>"; b.lastChild.textContent = sc.title;
    b.addEventListener("click", function () { show(k); });
    li.appendChild(b); list.appendChild(li);
  });
  function show(k) {
    i = Math.max(0, Math.min(S.scenes.length, k));
    var finished = i === S.scenes.length;
    var sc = S.scenes[i];
    count.textContent = finished ? L.done : L.step + " " + (i + 1) + " " + L.of + " " + S.scenes.length;
    title.textContent = finished ? L.done : sc.title;
    text.textContent = finished ? L.doneText : sc.text;
    app.innerHTML = finished
      ? '<div class="done-card fade"><div style="font-size:42px">🎉</div><b>' + L.done + "</b><p class=\"s-muted\">" + L.doneText + "</p></div>"
      : '<div class="fade">' + sc.screen + "</div>";
    app.scrollTop = 0;
    var hot = app.querySelector("[data-hot]");
    tip.hidden = finished;
    if (!finished) tip.lastElementChild.innerHTML = "<b>" + (hot ? "👆 " : "→ ") + "</b>" + (sc.tip || L.tap);
    if (hot) {
      hot.setAttribute("tabindex", "0"); hot.setAttribute("role", "button");
      hot.addEventListener("click", function () { show(i + 1); });
      hot.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i + 1); } });
      setTimeout(function () { hot.scrollIntoView({ block: "center", behavior: "smooth" }); }, 120);
    }
    bar.style.width = (Math.min(i, S.scenes.length) / S.scenes.length) * 100 + "%";
    prev.disabled = i === 0;
    next.textContent = finished ? L.restart : L.next;
    [].forEach.call(list.querySelectorAll("button"), function (b, k2) { b.className = k2 === i ? "cur" : k2 < i ? "done" : ""; });
  }
  prev.addEventListener("click", function () { show(i - 1); });
  next.addEventListener("click", function () { show(i === S.scenes.length ? 0 : i + 1); });
  show(0);
})();
