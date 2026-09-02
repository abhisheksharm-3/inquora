import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Inquora — down for a rebuild",
  description: "Inquora is offline while it is rebuilt from the database up.",
};

const specimens = [
  {
    source: "Why",
    passage:
      "Two hundred and thirteen of two hundred and forty-one documents were stuck unprocessed, and answers were assembled from eight model calls before the first word appeared. That is not a bug list, it is a foundation problem.",
  },
  {
    source: "What is being replaced",
    passage:
      "The schema, with derived state maintained by the database rather than by application code that mostly did not run. Retrieval, as one hybrid query instead of four dense ones. Streaming, so the answer arrives as it is written.",
  },
  {
    source: "What is not changing",
    passage:
      "Every answer stays traceable to the passage it came from. Your documents stay yours, and nothing trains on them.",
  },
];

const budget = [
  ["Model calls before an answer", "5 to 8", "1, or 2 when it searches"],
  ["Embedding calls per question", "4 to 8", "1, cached"],
  ["Vector searches per question", "4 to 8", "1"],
  ["Database roundtrips per turn", "8, sequential", "3"],
  ["First word of the answer", "after the whole answer", "as it is written"],
];

const swaps = [
  [
    "Retrieval",
    "Four dense vector queries to a separate service, re-ranked by counting shared words.",
    "One query that runs vector and full-text search together and fuses them by rank, in the same database as everything else.",
  ],
  [
    "Correctness of state",
    "Application code wrote back whether a document had finished processing, and usually did not.",
    "The database maintains it. A count cannot drift from the rows it counts.",
  ],
  [
    "Failures",
    "Saved as assistant messages, so every error became a permanent turn in the conversation.",
    "Errors are errors. They are reported, not remembered as something the assistant said.",
  ],
];

/**
 * The landing page while the product is offline. Static on purpose: no client
 * components and no WebGL, so the one page that has to work cannot be broken by
 * the rebuild happening behind it.
 */
const Home = () => (
  <main className={styles.page}>
    <div className={styles.nav}>
      <span className={styles.wordmark}>Inquora</span>
      <span>Offline · rebuilding</span>
    </div>

    <div className={styles.stage}>
      <h1 className={styles.thesis}>
        Inquora is down, and is being <em>rebuilt</em>.
      </h1>

      <p className={styles.sub}>
        The version that stood here has been taken offline. It is being rebuilt from the database
        up, so nothing is being patched around:{" "}
        <b>the schema, retrieval, streaming and the interface are all being replaced</b>, in that
        order.
      </p>

      <p className={styles.note}>
        <b>There is nothing to sign in to in the meantime.</b> This page is the whole site until the
        rebuild reaches a version worth using.
      </p>
    </div>

    <aside className={styles.apparatus}>
      <div className={styles.apparatusHead}>
        <span>Apparatus</span>
        <span>{specimens.length} specimens</span>
      </div>

      {specimens.map((specimen, index) => (
        <div className={styles.specimen} key={specimen.source}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className={styles.source}>{specimen.source}</p>
            <p className={styles.passage}>{specimen.passage}</p>
          </div>
        </div>
      ))}
    </aside>

    <section className={styles.ledger}>
      <div className={styles.ledgerMain}>
        <h2 className={styles.heading}>What the rebuild is measured against</h2>
        <p className={styles.lede}>
          The old system was slow because of how much it did per question, not because of where it
          ran. These are the numbers being designed to, per question asked.
        </p>

        <div className={styles.scroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Per question</th>
                <th scope="col">Was</th>
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {budget.map(([metric, was, target]) => (
                <tr key={metric}>
                  <td>{metric}</td>
                  <td>{was}</td>
                  <td className={styles.target}>{target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.caption}>
          Measured on 2026-08-25 against the running system. Targets are the design budget, not
          results: they will be published once the rebuild can be measured the same way.
        </p>
      </div>

      <aside className={styles.ledgerSide}>
        <p className={styles.sideHead}>Three things changing shape</p>
        <dl className={styles.swap}>
          {swaps.map(([title, was, now]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>
                <span className={styles.was}>Was</span>
                {was}
              </dd>
              <dd>
                <span className={styles.now}>Now</span>
                <b>{now}</b>
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </section>
  </main>
);

export default Home;
