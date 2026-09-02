import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractSlides } from "./extract-slides";

const presentation = async (slides: string[][]) => {
  const zip = new JSZip();

  slides.forEach((texts, index) => {
    const body = texts.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join("");
    zip.file(`ppt/slides/slide${index + 1}.xml`, `<p:sld><p:cSld>${body}</p:cSld></p:sld>`);
  });

  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
};

describe("extractSlides", () => {
  it("reads the text of each slide, in order", async () => {
    const bytes = await presentation([
      ["Q3 review", "Revenue under forecast"],
      ["Northern region", "Three deals slipped"],
    ]);

    const result = await extractSlides(bytes);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slides).toHaveLength(2);
      expect(result.value.slides[0]).toMatchObject({ number: 1 });
      expect(result.value.slides[0].text).toContain("Revenue under forecast");
    }
  });

  it("orders slides numerically, not by string, so slide 10 follows slide 9", async () => {
    const bytes = await presentation(Array.from({ length: 11 }, (_, i) => [`Slide body ${i + 1}`]));

    const result = await extractSlides(bytes);

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.slides.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("unescapes XML entities rather than embedding them", async () => {
    const bytes = await presentation([["Revenue &amp; margin &lt; forecast"]]);

    const result = await extractSlides(bytes);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slides[0].text).toBe("Revenue & margin < forecast");
  });

  it("says so when a presentation has no readable text", async () => {
    const bytes = await presentation([[]]);

    const result = await extractSlides(bytes);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("readable text");
  });

  it("refuses a file that is not a presentation", async () => {
    const result = await extractSlides(new TextEncoder().encode("not a zip"));

    expect(result.ok).toBe(false);
  });
});
