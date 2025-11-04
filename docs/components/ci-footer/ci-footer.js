const styleURL = new URL("./ci-footer.css", import.meta.url);
const templateURL = new URL("./ci-footer.html", import.meta.url);

class CiFooter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return [
      "site-url",
      "source-url",
      "dashboard-version",
      "last-updated",
      "copyright",
    ];
  }

  async connectedCallback() {
    const [style, html] = await Promise.all([
      fetch(styleURL).then((res) => res.text()),
      fetch(templateURL).then((res) => res.text()),
    ]);

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      ${html}
    `;

    // Initial render
    this.renderFooter();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.renderFooter();
    }
  }

  renderFooter() {
    this.updateHref(
      ".site-url",
      this.getAttribute("site-url") ||
        "https://civic-interconnect.github.io/app-core/",
      "Site"
    );

    this.updateHref(
      ".source-url",
      this.getAttribute("source-url") ||
        "https://github.com/civic-interconnect/app-core",
      "Source"
    );

    this.updateText(
      ".version",
      `Version: ${this.getAttribute("dashboard-version") || "v0.0.0"}`
    );

    this.updateText(
      ".updated",
      `Updated: ${
        this.getAttribute("last-updated") ||
        new Date().toLocaleDateString()
      }`
    );

    this.updateText(
      ".copyright",
      this.getAttribute("copyright") ||
        `© ${new Date().getFullYear()} Civic Interconnect`
    );
  }

  updateText(selector, text) {
    const el = this.shadowRoot.querySelector(selector);
    if (el) {
      el.textContent = text;
    }
  }

  updateHref(selector, href, text) {
    const el = this.shadowRoot.querySelector(selector);
    if (el) {
      el.setAttribute("href", href);
      el.textContent = text;
    }
  }
}

customElements.define("ci-footer", CiFooter);
