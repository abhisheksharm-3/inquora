"use client";

import { useActionState, useState } from "react";
import { createChat } from "@/app/(app)/actions";
import { type ActionState, emptyActionState } from "@/app/(app)/app.types";
import type { DocumentEntry } from "@/core/workspace/workspace.types";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import { Reading, Surface, SurfaceHeading } from "@/ui/components/apparatus/Surface";
import { Action } from "@/ui/components/form/Action";
import { useDocumentProgress } from "@/ui/hooks/useDocumentProgress";
import { useUpload } from "@/ui/hooks/useUpload";
import { DocumentList } from "./DocumentList";
import { ingestionEntries } from "./ingestion-log";
import { toolEntriesFor } from "./tool-availability";
import { UploadDrop } from "./UploadDrop";

/**
 * Surfaces 03 and 04, which the mockups drew separately and which are one act:
 * you arrive with a file, and the register is where it lands.
 *
 * The apparatus follows what is happening. While files are being added it is the
 * ingestion log, with real timings and a true fraction; otherwise it says what
 * the current selection buys you, which tools it switches on and which stay off.
 *
 * Selection lives here rather than on the server because the apparatus has to
 * change as it changes, and a round trip per checkbox would make it lag.
 */
export const ChooseSurface = ({
  chrome,
  documents: seed,
  userId,
}: {
  chrome: React.ReactNode;
  documents: DocumentEntry[];
  userId: string;
}) => {
  const documents = useDocumentProgress(seed, userId);
  const { uploads, add, dismiss } = useUpload();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [state, submit] = useActionState<ActionState, FormData>(createChat, emptyActionState);

  const chosen = documents.filter((document) => selected.has(document.id));
  const inFlight = uploads.filter((upload) => upload.phase !== "ready");

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Surface
      chrome={chrome}
      apparatusLabel={inFlight.length > 0 ? "Reading your files" : "What you can ask"}
      apparatus={
        <ApparatusColumn
          entries={
            inFlight.length > 0 ? ingestionEntries(uploads, documents) : toolEntriesFor(chosen)
          }
          label={inFlight.length > 0 ? "Reading your files" : "What you can ask"}
        />
      }
    >
      <Reading>
        <SurfaceHeading lede="Pick one or several. You can add more later without starting over.">
          What are we reading?
        </SurfaceHeading>

        <form action={submit}>
          {documents.length === 0 ? (
            <p className="mb-6 border-rule border-y py-6 font-light font-reading text-[1.05rem] text-soft">
              Nothing is indexed yet. Add a document below and it appears here the moment it is
              readable.
            </p>
          ) : (
            <DocumentList documents={documents} selected={selected} onToggle={toggle} />
          )}

          {/* The chosen titles travel with the submit, so the conversation is
              named after what it is about without a second read. */}
          {chosen.map((document) => (
            <input key={document.id} type="hidden" name="document-title" value={document.title} />
          ))}

          <div className="flex flex-wrap items-center gap-5">
            <Action pendingLabel="Starting">Start reading</Action>
            <p aria-live="polite" className="font-record text-label text-faint">
              {chosen.length === 0
                ? "Nothing selected"
                : `${chosen.length} selected · ${chosen
                    .reduce((total, document) => total + document.chunkCount, 0)
                    .toLocaleString()} passages`}
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="mt-3 font-record text-label text-danger">
              {state.error}
            </p>
          ) : null}
        </form>

        <UploadDrop uploads={uploads} onAdd={add} onDismiss={dismiss} />
      </Reading>
    </Surface>
  );
};
