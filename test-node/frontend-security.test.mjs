import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("dashboard does not persist the admin password across browser sessions", () => {
  assert.doesNotMatch(appSource, /localStorage/);
});

test("routine reminder messages are rendered as text, not HTML", () => {
  const dom = new JSDOM('<div id="reminders-container"></div>', {
    runScripts: "outside-only",
    url: "https://example.com/",
  });
  dom.window.eval(appSource);

  const malicious = '</textarea><img src=x onerror="globalThis.pwned=true">';
  const card = dom.window.createReminderCard(
    {
      time: "09:00",
      daysOfWeek: [0],
      message: malicious,
    },
    0
  );

  assert.equal(card.querySelector("img"), null);
  assert.equal(card.querySelector(".r-msg").value, malicious);
});

test("one-off reminder messages are rendered as text, not HTML", () => {
  const dom = new JSDOM('<div id="oneoff-list"></div>', {
    runScripts: "outside-only",
    url: "https://example.com/",
  });
  dom.window.eval(appSource);

  const malicious = '<img src=x onerror="globalThis.pwned=true">';
  dom.window.renderOneOffList([
    {
      id: "oneoff-xss",
      datetime: "2026-09-07T01:00:00.000Z",
      message: malicious,
    },
  ]);

  const container = dom.window.document.getElementById("oneoff-list");
  assert.equal(container.querySelector("img"), null);
  assert.equal(container.querySelector(".oneoff-item-msg").textContent, malicious);
});

test("partial historical measurements render missing BP values as dashes", () => {
  const dom = new JSDOM('<table><tbody id="bp-table-body"></tbody></table>', {
    runScripts: "outside-only",
    url: "https://example.com/",
  });
  dom.window.eval(appSource);
  dom.window.renderBpTable([
    { id: "weight-only", date: "2026-08-01", sys: null, dia: null, hr: null, weight: 61.5 },
  ]);

  const cells = [...dom.window.document.querySelectorAll("td")].map((cell) => String(cell.innerText));
  assert.deepEqual(cells.slice(0, 4), ["2026-08-01", "- / -", "-", "61.5"]);
});
