"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addTeamCard, addTeamCardPhoto, deleteTeamCard, deleteTeamCardPhoto, updateTeamCard } from "@/app/actions/team-cards";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormModal } from "@/components/form-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, TEAM_CARD_ACCEPT, type TeamCardExtract, type TeamCardRow, type TeamCardSection } from "@/lib/team-cards/model";

export type TeamCardListItem = {
  id: string;
  section: TeamCardSection;
  event_name: string;
  created_at: string;
  team_card_members: {
    id: string;
    position: number;
    student_id: string;
    full_name: string;
    jersey_no: string | null;
  }[];
  team_card_photos: { id: string; file_name: string }[];
  linkedCount: number;
};

const SECTIONS: { id: TeamCardSection; title: string }[] = [
  { id: "sports-fiesta", title: "Sport Fiesta team cards" },
  { id: "inter-university", title: "Inter University Championships team cards" },
];

export function TeamCardsClient({
  cards,
  canEdit,
  initialCardId,
}: {
  cards: TeamCardListItem[];
  canEdit: boolean;
  initialCardId: string | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(initialCardId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamCardListItem | null>(null);
  const [deleting, setDeleting] = useState<TeamCardListItem | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Team Cards</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Student ID, name, and jersey number from Sports Fiesta entry forms and Inter University team cards.
          </p>
        </div>
        {canEdit && <Button onClick={() => { setError(null); setAdding(true); }}>Add Data</Button>}
      </div>

      {SECTIONS.map((section) => {
        const rows = cards.filter((card) => card.section === section.id);
        return (
          <div key={section.id} className="space-y-3">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white">{section.title}</h3>
            {rows.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No team cards in this section yet.</p>
              </Card>
            ) : (
              rows.map((card) => (
                <Card key={card.id} id={card.id} className="space-y-4">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                    aria-expanded={openId === card.id}
                    onClick={() => setOpenId(openId === card.id ? null : card.id)}
                  >
                    <span>
                      <span className="block font-medium text-zinc-900 dark:text-white">{card.event_name}</span>
                      <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                        {new Date(card.created_at).toLocaleDateString()} · {card.team_card_members.length} athletes · {card.team_card_photos.length} photos
                      </span>
                    </span>
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">{openId === card.id ? "Hide" : "Show"}</span>
                  </button>
                  {openId === card.id && (
                    <div className="space-y-4">
                      <MemberTable members={card.team_card_members} />
                      {card.team_card_photos.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {card.team_card_photos.map((photo) => (
                            <figure key={photo.id} className="w-28">
                              <a href={`/api/team-cards/photos/${photo.id}`} target="_blank" rel="noreferrer">
                                <img src={`/api/team-cards/photos/${photo.id}`} alt={photo.file_name} className="h-28 w-28 rounded-lg object-cover" />
                              </a>
                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="mt-1 w-full px-2 py-1"
                                  disabled={pending}
                                  onClick={() => removePhoto(photo.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </figure>
                          ))}
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="secondary" onClick={() => { setError(null); setEditing(card); }}>Edit</Button>
                          <Button type="button" variant="danger" onClick={() => { setError(null); setDeleting(card); }}>Delete</Button>
                          <label className="text-sm text-zinc-600 dark:text-zinc-300">
                            <span className="mr-2">Add photo</span>
                            <input
                              type="file"
                              accept={PHOTO_ACCEPT}
                              disabled={pending || card.team_card_photos.length >= PHOTO_MAX_COUNT}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void uploadPhoto(card.id, file);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        );
      })}

      {adding && (
        <AddDialog
          pending={pending}
          error={error}
          onClose={() => { if (!pending) { setAdding(false); setError(null); } }}
          onSave={(payload) => void saveNew(payload)}
        />
      )}
      {editing && (
        <EditDialog
          card={editing}
          pending={pending}
          error={error}
          onClose={() => { if (!pending) { setEditing(null); setError(null); } }}
          onSave={(eventName, rows) => void saveEdit(editing.id, eventName, rows)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete “${deleting.event_name}”?` : "Delete team card?"}
        titleId="delete-team-card-title"
        description={
          deleting && deleting.linkedCount > 0
            ? `This team card is linked to ${deleting.linkedCount} achievement${deleting.linkedCount === 1 ? "" : "s"}. Those achievements stay, and the link is cleared.`
            : "This removes the team card, its athletes, and its reference photos."
        }
        pending={pending}
        error={deleting ? error : null}
        onClose={() => { if (!pending) { setDeleting(null); setError(null); } }}
        onConfirm={() => { if (deleting) void removeCard(deleting.id); }}
      />
    </section>
  );

  async function saveNew(payload: { eventName: string; section: TeamCardSection; sourceKind: string; fileName: string; rows: TeamCardRow[]; photos: File[] }) {
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("event_name", payload.eventName);
    form.set("section", payload.section);
    form.set("source_kind", payload.sourceKind);
    form.set("source_file_name", payload.fileName);
    form.set("members", JSON.stringify(payload.rows));
    const saved = await addTeamCard(form);
    if ("error" in saved && saved.error) {
      setPending(false);
      setError(saved.error);
      return;
    }
    if (!("id" in saved) || !saved.id) {
      setPending(false);
      setError("error" in saved ? saved.error ?? "The team card could not be saved." : "The team card could not be saved.");
      return;
    }
    const cardId = saved.id;
    for (const photo of payload.photos) {
      const photoError = await uploadPhoto(cardId, photo, false);
      if (photoError) {
        setPending(false);
        setError(`The team card was saved, but a photo could not be stored: ${photoError}`);
        setAdding(false);
        router.refresh();
        return;
      }
    }
    setPending(false);
    setAdding(false);
    setOpenId(cardId);
    router.refresh();
  }

  async function saveEdit(id: string, eventName: string, rows: TeamCardRow[]) {
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("id", id);
    form.set("event_name", eventName);
    form.set("members", JSON.stringify(rows));
    const result = await updateTeamCard(form);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function removeCard(id: string) {
    setPending(true);
    setError(null);
    const result = await deleteTeamCard(id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  async function uploadPhoto(cardId: string, file: File, refresh = true) {
    if (file.size > PHOTO_MAX_BYTES) {
      if (refresh) setError("Each photo must be 4 MB or smaller.");
      return "Each photo must be 4 MB or smaller.";
    }
    if (refresh) {
      setPending(true);
      setError(null);
    }
    const form = new FormData();
    form.set("team_card_id", cardId);
    form.set("file", file);
    const result = await addTeamCardPhoto(form);
    if (refresh) setPending(false);
    if (result.error) {
      if (refresh) setError(result.error);
      return result.error;
    }
    if (refresh) router.refresh();
    return null;
  }

  async function removePhoto(id: string) {
    setPending(true);
    setError(null);
    const result = await deleteTeamCardPhoto(id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }
}

function MemberTable({ members }: { members: { student_id: string; full_name: string; jersey_no: string | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            <th className="px-2 py-2 font-medium">Student ID</th>
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Jersey No</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.student_id} className="border-b border-zinc-100 last:border-0 dark:border-white/10">
              <td className="px-2 py-2 text-zinc-900 dark:text-white">{member.student_id}</td>
              <td className="px-2 py-2 text-zinc-900 dark:text-white">{member.full_name}</td>
              <td className="px-2 py-2 text-zinc-700 dark:text-zinc-300">{member.jersey_no ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddDialog({
  pending,
  error,
  onClose,
  onSave,
}: {
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: { eventName: string; section: TeamCardSection; sourceKind: string; fileName: string; rows: TeamCardRow[]; photos: File[] }) => void;
}) {
  const [eventName, setEventName] = useState("");
  const [section, setSection] = useState<TeamCardSection | "">("");
  const [sourceKind, setSourceKind] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<TeamCardRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  const shownError = error ?? readError;

  async function onFile(file: File) {
    setReading(true);
    setReadError(null);
    setRows([]);
    setWarnings([]);
    setSourceKind("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/team-cards/extract", { method: "POST", body: form });
    const body = (await response.json()) as TeamCardExtract & { error?: string };
    setReading(false);
    if (!response.ok || body.error) {
      setReadError(body.error ?? "The team card could not be read.");
      return;
    }
    setFileName(file.name);
    setSourceKind(body.sourceKind);
    setSection(body.section ?? "");
    setRows(body.rows);
    setWarnings(body.warnings);
  }

  return (
    <FormModal open title="Add team card" titleId="add-team-card-title" onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="team-card-event">Event name</Label>
          <Input id="team-card-event" required value={eventName} onChange={(event) => setEventName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="team-card-file">Team card file</Label>
          <input
            id="team-card-file"
            type="file"
            required
            accept={TEAM_CARD_ACCEPT}
            className="block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          {reading && <p className="mt-1 text-sm text-zinc-500">Reading the team card…</p>}
        </div>
        <div>
          <Label htmlFor="team-card-photos">Reference photos (optional, up to 10)</Label>
          <input
            id="team-card-photos"
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="block w-full text-sm"
            onChange={(event) => {
              const next = [...(event.target.files ?? [])].slice(0, PHOTO_MAX_COUNT);
              const tooBig = next.find((file) => file.size > PHOTO_MAX_BYTES);
              if (tooBig) {
                setReadError("Each photo must be 4 MB or smaller.");
                setPhotos([]);
                return;
              }
              if ((event.target.files?.length ?? 0) > PHOTO_MAX_COUNT) {
                setReadError("A team card can have at most 10 photos.");
              }
              setPhotos(next);
            }}
          />
          {photos.length > 0 && <p className="mt-1 text-sm text-zinc-500">{photos.length} photo{photos.length === 1 ? "" : "s"} selected. These are not read as the team card.</p>}
        </div>
        {sourceKind && (
          <div>
            <Label htmlFor="team-card-section">Section</Label>
            <Select id="team-card-section" required value={section} onChange={(event) => setSection(event.target.value as TeamCardSection)}>
              <option value="">Choose a section</option>
              <option value="sports-fiesta">Sports Fiesta</option>
              <option value="inter-university">Inter University</option>
            </Select>
          </div>
        )}
        {warnings.map((warning) => (
          <p key={warning} className="text-sm text-amber-700 dark:text-amber-300">{warning}</p>
        ))}
        {rows.length > 0 && <RowEditor rows={rows} onChange={setRows} />}
        {shownError && <p className="text-sm text-red-600 dark:text-red-400">{shownError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            type="button"
            disabled={pending || reading || !sourceKind}
            onClick={() => {
              if (!section) {
                setReadError("Choose Sports Fiesta or Inter University.");
                return;
              }
              onSave({ eventName, section, sourceKind, fileName, rows, photos });
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

function EditDialog({
  card,
  pending,
  error,
  onClose,
  onSave,
}: {
  card: TeamCardListItem;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (eventName: string, rows: TeamCardRow[]) => void;
}) {
  const [eventName, setEventName] = useState(card.event_name);
  const [rows, setRows] = useState<TeamCardRow[]>(
    card.team_card_members.map((member) => ({
      studentId: member.student_id,
      fullName: member.full_name,
      jerseyNo: member.jersey_no,
    }))
  );
  return (
    <FormModal open title="Edit team card" titleId="edit-team-card-title" onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="edit-team-card-event">Event name</Label>
          <Input id="edit-team-card-event" required value={eventName} onChange={(event) => setEventName(event.target.value)} />
        </div>
        <RowEditor rows={rows} onChange={setRows} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => onSave(eventName, rows)}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </FormModal>
  );
}

function RowEditor({ rows, onChange }: { rows: TeamCardRow[]; onChange: (rows: TeamCardRow[]) => void }) {
  const empty = useMemo(() => rows.length === 0, [rows.length]);
  return (
    <div className="space-y-2">
      {empty && <p className="text-sm text-zinc-500">No athletes were found. Add a row before saving.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem_auto]">
          <Input aria-label="Student ID" value={row.studentId} onChange={(event) => update(index, { studentId: event.target.value })} />
          <Input aria-label="Name" value={row.fullName} onChange={(event) => update(index, { fullName: event.target.value })} />
          <Input aria-label="Jersey No" value={row.jerseyNo ?? ""} onChange={(event) => update(index, { jerseyNo: event.target.value || null })} />
          <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...rows, { studentId: "", fullName: "", jerseyNo: null }])}>Add row</Button>
    </div>
  );

  function update(index: number, patch: Partial<TeamCardRow>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}
