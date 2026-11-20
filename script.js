/* All artwork, captions, and curatorial writing belong in index.html.
   This file adds navigation and viewing controls to those existing elements. */
(() => {
  "use strict";

  function button(label, action) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = "control";
    control.textContent = label;
    control.addEventListener("click", action);
    return control;
  }

  function makeTimeline() {
    const list = document.querySelector(".timeline ol");
    if (!list) return;
    const galleries = [...document.querySelectorAll("main section.gallery[id]")];
    const links = new Map();
    list.replaceChildren();
    galleries.forEach(gallery => {
      const heading = gallery.querySelector("h2");
      if (!heading) return;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + gallery.id;
      const era = document.createElement("span");
      era.className = "nav-era";
      era.textContent = gallery.dataset.era || "";
      link.append(era, gallery.dataset.stop || heading.textContent);
      link.addEventListener("click", () => {
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
      });
      links.set(gallery, link);
      item.append(link);
      list.append(item);
    });
    // Keep the chronological tab order while laying out alternate rows in reverse.
    const route = list.parentElement;
    const stroke = route.querySelector("path");
    const stops = [...list.children];
    function layoutRoute() {
      if (!stops.length || !list.clientWidth) return;
      const columns = Math.min(stops.length, Math.max(2, Math.floor(list.clientWidth / 150)));
      list.style.gridTemplateColumns = "repeat(" + columns + ", minmax(0, 1fr))";
      stops.forEach((item, index) => {
        const row = Math.floor(index / columns);
        const offset = index % columns;
        item.style.gridArea = (row + 1) + " / " + (row % 2 ? columns - offset : offset + 1);
      });
      const bounds = route.getBoundingClientRect();
      let path = "";
      let previous;
      stops.forEach((item, index) => {
        const box = item.getBoundingClientRect();
        const x = box.left - bounds.left + box.width / 2;
        const y = box.top - bounds.top + 9;
        if (!index) path = "M " + x + " " + y;
        else if (index % columns) path += " H " + x;
        else {
          const direction = Math.floor(index / columns) % 2 ? 1 : -1;
          const outer = direction > 0 ? bounds.width - 3 : 3;
          const radius = Math.min(26, Math.abs(outer - x), (y - previous) / 2);
          const inner = outer - direction * radius;
          path += " H " + inner + " Q " + outer + " " + previous + " " + outer + " " + (previous + radius)
               + " V " + (y-radius) + " Q " + outer + " " + y + " " + inner + " " + y + " H " + x;
        }
        previous = y;
      });
      stroke.setAttribute("d", path);
    }
    layoutRoute();
    new ResizeObserver(layoutRoute).observe(route);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        const entry = entries.find(item => item.isIntersecting);
        if (!entry) return;
        links.forEach(link => link.removeAttribute("aria-current"));
        links.get(entry.target)?.setAttribute("aria-current", "location");
      }, {rootMargin: "-10% 0px -58% 0px"});
      links.forEach((_, gallery) => observer.observe(gallery));
    }
  }

  const viewer = document.createElement("dialog");
  viewer.setAttribute("aria-label", "Artwork viewer");
  const tools = document.createElement("div");
  tools.className = "viewer-tools";
  const viewport = document.createElement("div");
  viewport.className = "viewer-art";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "Artwork detail. Scroll to explore when enlarged.");
  const display = document.createElement("img");
  const label = document.createElement("p");
  label.className = "viewer-label";
  const zoom = button("View detail", () => {
    const enlarged = viewport.classList.toggle("zoomed");
    zoom.setAttribute("aria-pressed", String(enlarged));
    zoom.textContent = enlarged ? "Fit whole work" : "View detail";
    if (enlarged) viewport.focus();
  });
  const close = button("Close viewer", () => viewer.close());
  close.autofocus = true;
  tools.append(zoom, close);
  viewport.append(display);
  viewer.append(tools, viewport, label);
  document.body.append(viewer);
  let opener;
  viewer.addEventListener("close", () => opener?.focus({preventScroll: true}));

  function addViewer(figure) {
    const image = figure.querySelector("img");
    if (!image || image.closest("button, a") || typeof viewer.showModal !== "function") return;
    const caption = figure.querySelector("figcaption");
    const trigger = button("", () => {
      opener = trigger;
      display.src = image.currentSrc || image.src;
      display.alt = image.alt;
      viewport.classList.remove("zoomed");
      viewport.style.setProperty("--natural-width", (image.naturalWidth || 1600) + "px");
      zoom.textContent = "View detail";
      zoom.setAttribute("aria-pressed", "false");
      label.textContent = caption?.textContent.trim() || image.alt;
      viewer.showModal();
      close.focus();
    });
    trigger.className = "inspect-image";
    trigger.title = "Enlarge artwork";
    trigger.setAttribute("aria-label", "Enlarge artwork: " + (image.alt || caption?.textContent.trim() || ""));
    image.before(trigger);
    trigger.append(image);
  }

  function addComparison(container, index) {
    const ids = container.dataset.compare.trim().split(/\s+/);
    const works = ids.map(id => document.getElementById(id));
    if (works.length !== 2 || works.some(figure => !figure?.querySelector("img"))) return;
    const pair = document.createElement("div");
    pair.className = "comparison-works";
    pair.id = "comparison-pair-" + index;
    pair.hidden = true;
    const compareLabel = container.dataset.label || "Compare these works";
    const toggle = button(compareLabel, () => {
      pair.hidden = !pair.hidden;
      toggle.setAttribute("aria-expanded", String(!pair.hidden));
      toggle.textContent = pair.hidden ? compareLabel : "Close comparison";
    });
    toggle.setAttribute("aria-controls", pair.id);
    toggle.setAttribute("aria-expanded", "false");
    works.forEach(work => {
      const copy = document.createElement("figure");
      const source = work.querySelector("img");
      const image = document.createElement("img");
      image.src = source.getAttribute("src");
      image.alt = source.alt;
      image.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = work.querySelector("figcaption")?.textContent.trim() || image.alt;
      copy.append(image, caption);
      pair.append(copy);
      addViewer(copy);
    });
    container.append(toggle, pair);
  }

  function addHandscroll(container) {
    const original = document.getElementById(container.dataset.scroll)?.querySelector("img");
    if (!original) return;
    const frame = document.createElement("div");
    frame.className = "scroll-view";
    const image = document.createElement("img");
    image.alt = original.alt;
    const controls = document.createElement("div");
    controls.className = "scroll-controls";
    const status = document.createElement("span");
    status.className = "scroll-status";
    status.setAttribute("aria-live", "polite");
    // Indices run in traditional reading order: right edge to left edge.
    let detail = 0;
    let last = 0;
    const previous = button("Previous detail", () => { detail--; position(); });
    const next = button("Next detail", () => { detail++; position(); });
    function position() {
      if (!image.naturalWidth || !frame.clientWidth) return;
      const overflow = Math.max(0, image.clientWidth - frame.clientWidth);
      last = Math.ceil(overflow / (frame.clientWidth * .8));
      detail = Math.max(0, Math.min(detail, last));
      frame.scrollLeft = last ? overflow * (1 - detail / last) : 0;
      previous.disabled = detail === 0;
      next.disabled = detail === last;
      status.textContent = "Detail " + (detail + 1) + " of " + (last + 1);
    }
    image.addEventListener("load", position);
    frame.append(image);
    controls.append(previous, next, status);
    container.append(frame, controls);
    image.src = original.getAttribute("src");
    if ("ResizeObserver" in window) new ResizeObserver(position).observe(frame);
    else window.addEventListener("resize", position);
  }

  function addCrop(container) {
    const work = document.getElementById(container.dataset.crop);
    const image = work?.querySelector("img");
    const inspect = work?.querySelector(".inspect-image");
    if (!image || !inspect) return;
    const trigger = button(container.dataset.label || "Inspect this detail", () => {
      inspect.click();
      opener = trigger;
      zoom.click();
      const center = () => {
        const x = Number(container.dataset.x || 50) / 100;
        const y = Number(container.dataset.y || 50) / 100;
        viewport.scrollLeft = display.clientWidth * x - viewport.clientWidth / 2;
        viewport.scrollTop = display.clientHeight * y - viewport.clientHeight / 2;
      };
      if (display.complete) requestAnimationFrame(center);
      else display.addEventListener("load", center, {once: true});
    });
    container.append(trigger);
  }

  // The tracing remains a native disclosure when scripts are unavailable.
  function addTracing() {
    const disclosure = document.querySelector("details.tracing");
    const traced = disclosure?.querySelector("figure");
    const panel = disclosure?.closest(".gallery")?.querySelector("#cave-art");
    if (!traced || !panel) return;
    const holder = document.createElement("div");
    holder.className = "tracing-switch";
    const toggle = button("Show research tracing", () => {
      const showTracing = traced.hidden;
      traced.hidden = !showTracing;
      panel.hidden = showTracing;
      toggle.textContent = showTracing ? "Show cave photograph" : "Show research tracing";
      toggle.setAttribute("aria-pressed", String(showTracing));
    });
    toggle.setAttribute("aria-pressed", "false");
    holder.append(toggle);
    panel.before(holder);
    traced.hidden = true;
    panel.after(traced);
    traced.classList.add("matched-panel");
    panel.classList.add("matched-panel");
    disclosure.hidden = true;
  }

  const festivalReturn = document.querySelector("#return-festival");
  festivalReturn?.addEventListener("click", event => {
    const festival = document.querySelector("#festival-art");
    if (!festival) return;
    event.preventDefault();
    const reveal = festivalReturn.closest("details");
    if (reveal) reveal.open = false;
    festival.scrollIntoView({block: "start"});
    festival.querySelector("button")?.focus({preventScroll: true});
  });

  makeTimeline();
  document.querySelectorAll("figure").forEach(addViewer);
  document.querySelectorAll("[data-compare]").forEach(addComparison);
  document.querySelectorAll("[data-scroll]").forEach(addHandscroll);
  document.querySelectorAll("[data-crop]").forEach(addCrop);
  addTracing();
})();

