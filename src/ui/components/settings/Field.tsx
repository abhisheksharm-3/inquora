/**
 * One labelled fact, or one figure.
 *
 * A settings page is mostly rows of "here is a thing, here is its value", and
 * writing that twice in two shapes is how the earlier versions ended up with
 * five numbers at heading size in one place and a dim table in another.
 */
export const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-6 border-rule border-b py-3">
    <dt className="shrink-0 font-record text-record text-faint">{label}</dt>
    <dd className="m-0 min-w-0 truncate font-light font-reading text-[1.05rem] text-ink">
      {value}
    </dd>
  </div>
);

export const Figure = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div>
    <p className="m-0 font-light font-reading text-[1.9rem] text-ink leading-none tabular tracking-[-0.015em]">
      {value}
    </p>
    <p className="mt-2 font-medium font-record text-label text-soft">{label}</p>
    {note ? <p className="mt-1 font-record text-label text-faint">{note}</p> : null}
  </div>
);
