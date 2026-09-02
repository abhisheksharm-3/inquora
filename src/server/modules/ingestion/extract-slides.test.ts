import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractSlides } from "./extract-slides";

const presentation = async (slides: string[][]) => {
  const files: Record<string, Uint8Array> = {};

  slides.forEach((texts, index) => {
    const body = texts.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join("");
    files[`ppt/slides/slide${index + 1}.xml`] = strToU8(`<p:sld><p:cSld>${body}</p:cSld></p:sld>`);
  });

  // A media part the reader must skip rather than inflate.
  files["ppt/media/image1.png"] = new Uint8Array([137, 80, 78, 71]);

  return zipSync(files);
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
