let counterElement = null;
let lastCommentTarget = null;
let lastCommentTimestamp = 0;

function ensureCounterUI() {
  const body = document.body;
  if (!body) return;

  if (counterElement && counterElement.isConnected) return;

  counterElement = document.createElement("div");
  counterElement.id = "linkedin-comment-counter";
  counterElement.innerHTML = `
    <div class="counter-card-title">Comments</div>
    <div>Today: 0</div>
    <div>This Week: 0</div>
    <div>This Month: 0</div>
  `;

  body.appendChild(counterElement);
  updateCounter();
}

function sendMessage(type, callback) {
  chrome.runtime.sendMessage({ type }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }

    callback?.(response);
  });
}

function renderCounter(response) {
  if (!response || !counterElement) return;

  const dailyCount = Number(response.dailyCount ?? response.count ?? 0);
  const weeklyCount = Number(response.weeklyCount ?? 0);
  const monthlyCount = Number(response.monthlyCount ?? 0);

  counterElement.innerHTML = `
    <div class="counter-card-title">Comments</div>
    <div>Today: ${dailyCount}</div>
    <div>This Week: ${weeklyCount}</div>
    <div>This Month: ${monthlyCount}</div>
  `;
}

function updateCounter() {
  sendMessage("GET_COMMENT_COUNT", (response) => {
    renderCounter(response);
  });
}

function incrementCounter() {
  sendMessage("INCREMENT_COMMENT_COUNT", (response) => {
    renderCounter(response);
  });
}

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isDecorativeIconElement(element) {
  if (!(element instanceof Element)) return false;

  const tagName = element.tagName.toLowerCase();
  return ["svg", "path", "use", "img", "i"].includes(tagName);
}

function getInteractiveElement(element) {
  if (!(element instanceof Element)) return null;

  return element.closest("button, [role='button'], a[href]");
}

function isCommentToggleButton(control) {
  // The toolbar "Comment" action (opens the comment box) lives in the same
  // social-actions bar as Like/Repost/Send, and toggles an aria-expanded
  // state rather than submitting anything.
  if (control.hasAttribute("aria-expanded")) return true;

  const socialBar = control.closest(
    "[class*='social-actions'], [class*='feed-shared-social-action-bar']",
  );
  return !!socialBar;
}

function findNearbyTextInput(control) {
  // The submit button lives right next to the comment editor's text input
  // (typically 1-2 wrapper divs up), but we don't know LinkedIn's exact
  // container class, so walk up a couple of ancestors looking for a sibling
  // text input instead of requiring one specific wrapper class name.
  //
  // This walk must stay shallow: LinkedIn keeps a post's (possibly hidden/
  // collapsed) comment editor in the DOM as a descendant of the *whole post*
  // container, which also contains the toolbar "Comment" toggle button.
  // Walking too many levels up from the toggle button eventually reaches
  // that shared post container and incorrectly "finds" the editor, even
  // though it isn't actually near the toggle button.
  let node = control;

  for (let i = 0; i < 2 && node; i += 1) {
    const input = node.querySelector(
      "[contenteditable='true'], textarea, .ql-editor",
    );
    if (input) return input;

    node = node.parentElement;
  }

  return null;
}

function hasCommentSubmitComponentKey(control) {
  // LinkedIn's current build stamps the real "post comment" button with a
  // componentkey containing "commentButtonSection" (e.g.
  // "...-commentButtonSectionzKIZ...FEED_RELEVANCE"). The toolbar toggle
  // button's componentkey doesn't contain this. Class names are fully
  // obfuscated and rotate, but this componentkey substring has proven to be
  // a stable, purpose-specific marker, so treat it as a strong positive
  // signal rather than requiring DOM-proximity heuristics alone.
  const componentKey = normalizeText(control.getAttribute("componentkey"));
  return /commentbuttonsection/.test(componentKey);
}

function isCommentSubmitButton(control) {
  // The real "post comment" button is a submit control that lives near the
  // comment editor's text input, not in the post's social-actions bar.
  // LinkedIn reshuffles its obfuscated class suffixes over time (e.g. the
  // "--cr" cohort), so class-name substrings are only ever a secondary
  // signal here, never a required one.
  if (isCommentToggleButton(control)) return false;

  if (hasCommentSubmitComponentKey(control)) return true;

  return !!findNearbyTextInput(control);
}

function isCommentButton(element) {
  if (!element || !(element instanceof Element)) return false;

  const control = getInteractiveElement(element);
  if (!control) return false;

  if (isDecorativeIconElement(element)) {
    return false;
  }

  const targetTag = (element.tagName || "").toLowerCase();
  const targetText = normalizeText(element.innerText || element.textContent);
  const ariaLabel = normalizeText(control.getAttribute("aria-label"));
  const title = normalizeText(control.getAttribute("title"));
  const dataControlName = normalizeText(
    control.getAttribute("data-control-name"),
  );
  const text = normalizeText(control.innerText || control.textContent);

  const label = `${ariaLabel} ${title} ${dataControlName} ${text}`;
  const isCommentControl = /comment/.test(label);
  if (!isCommentControl) return false;

  if (element !== control) {
    const targetMatches =
      ["span", "div", "p"].includes(targetTag) && /comment/.test(targetText);
    if (!targetMatches) return false;
  }

  return isCommentSubmitButton(control);
}

document.addEventListener(
  "click",
  (event) => {
    if (!isCommentButton(event.target)) return;

    const now = Date.now();
    if (
      lastCommentTarget === event.target &&
      now - lastCommentTimestamp < 400
    ) {
      return;
    }

    lastCommentTarget = event.target;
    lastCommentTimestamp = now;

    incrementCounter();
  },
  true,
);

window.addEventListener("load", () => {
  ensureCounterUI();
  updateCounter();
});

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  ensureCounterUI();
} else {
  document.addEventListener("DOMContentLoaded", ensureCounterUI, {
    once: true,
  });
}
