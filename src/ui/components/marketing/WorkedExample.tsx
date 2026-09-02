/**
 * One real answer with its sources beside it.
 *
 * Shown rather than described. A visitor who has never used the product learns
 * more from this than from any sentence about provenance, which is why it earns
 * the space it takes on both the landing page and the sign-in screen.
 *
 * `stacked` puts the sources under the answer instead of beside it, for a
 * column too narrow to hold two.
 */
const answerSources = [
  {
    number: 1,
    document: "revenue-review-q3.pdf",
    where: "page 4",
    quote:
      "Q3 revenue of $4.12M fell 12% short of the $4.68M forecast, with the shortfall concentrated in the northern region.",
  },
  {
    number: 2,
    document: "q3-forecast.xlsx",
    where: "Deals, rows 12 to 48",
    quote: "Average contract value: 41,500 actual against 48,000 forecast.",
  },
];

export const WorkedExample = ({ stacked = false }: { stacked?: boolean }) => (
  <div
    className={stacked ? "" : "grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]"}
  >
    <div className={stacked ? "" : "px-7 py-8 wide:px-8"}>
      <p className="mb-3 font-record text-label text-faint uppercase tracking-[0.14em]">
        The question
      </p>
      <p className="mb-6 max-w-[30ch] font-normal font-reading text-[1.12rem] text-ink leading-snug after:mt-3.5 after:block after:h-px after:w-[26px] after:bg-mark">
        Why did Q3 revenue miss the forecast?
      </p>

      <div className="max-w-[58ch] font-light font-reading text-[0.98rem] text-soft leading-[1.7]">
        <p className="mb-4">
          Revenue closed at 4.12 million against a forecast of 4.68 million, a miss of twelve per
          cent
          <Mark number={1} />
        </p>
        <p className="mb-0">
          Most of the gap is average contract value, which fell from 48,000 to 41,500
          <Mark number={2} />. Three deals slipped past the quarter end in the northern region, and
          two of those closed in the first week of October
          <Mark number={1} />.
        </p>
      </div>
    </div>

    <div
      className={
        stacked
          ? "mt-8 border-rule border-t pt-7"
          : "border-rule border-t px-7 py-7 wide:border-t-0 wide:border-l wide:bg-panel"
      }
    >
      <h3 className="mb-5 flex items-baseline justify-between border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.14em]">
        <span>Sources</span>
        <span>{answerSources.length}</span>
      </h3>

      {answerSources.map((source) => (
        <div key={source.number} className="mb-4 grid grid-cols-[26px_minmax(0,1fr)] gap-3">
          <span className="grid size-[22px] place-items-center rounded-hair border border-mark font-semibold font-record text-label text-mark tabular">
            {source.number}
          </span>
          <div>
            <p className="mb-1.5 flex flex-wrap gap-2 font-record text-label text-faint">
              <span className="font-medium text-soft">{source.document}</span>
              <span>{source.where}</span>
            </p>
            <p className="m-0 max-w-[56ch] font-light font-reading text-[0.88rem] text-soft italic leading-relaxed">
              {source.quote}
            </p>
          </div>
        </div>
      ))}

      <p className="m-0 max-w-[40ch] font-record text-label text-faint leading-relaxed">
        Click a number and the document opens at those lines, marked. One click brings you back.
      </p>
    </div>
  </div>
);

/** The superscript number in the answer, exactly as the product renders it. */
const Mark = ({ number }: { number: number }) => (
  <sup className="ml-0.5 align-[0.42em] font-medium font-record text-[0.58rem] text-mark">
    {number}
  </sup>
);
