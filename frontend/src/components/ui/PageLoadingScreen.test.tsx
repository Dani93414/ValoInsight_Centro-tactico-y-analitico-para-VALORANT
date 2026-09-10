import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PageLoadingScreen from "./PageLoadingScreen";

describe("PageLoadingScreen", () => {
  it("muestra una pantalla completa de carga con estado accesible", () => {
    const markup = renderToStaticMarkup(<PageLoadingScreen />);

    expect(markup).toContain('class="page-loading-screen"');
    expect(markup).toContain('aria-label="Cargando página"');
    expect(markup).toContain("<h1>Cargando</h1>");
    expect(markup).toContain('class="page-loading-screen__video"');
    expect(markup).toContain('src="/content/loader/wingman-side-clear-loader.webm"');
    expect(markup).toContain('type="video/webm"');
    expect(markup).toContain('autoPlay=""');
    expect(markup).toContain('muted=""');
    expect(markup).toContain('loop=""');
    expect(markup).toContain('playsInline=""');
    expect(markup).toContain('preload="auto"');
    expect(markup).not.toContain("controls=");
    expect(markup).toContain('class="page-loading-screen__track-base"');
    expect(markup).toContain('class="page-loading-screen__track-reveal"');
    expect(markup).toContain('class="page-loading-screen__track-texture"');
    expect(markup).toMatch(/--loading-progress:[4-8](?:\.\d+)?/);
  });
});
