"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/app/actions/inventory";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_PHASES,
  type InventoryCategory,
  type InventoryPhase,
} from "@/lib/inventory";
import type { InventoryItem } from "@/lib/types/database";
import { blankCell, csvFileSlug, downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function InventoryClient({
  header,
  importAction,
  items,
  canEdit,
}: {
  header: React.ReactNode;
  importAction?: React.ReactNode;
  items: InventoryItem[];
  canEdit: boolean;
}) {
  const [phase, setPhase] = useState<InventoryPhase>("phase_01");
  const [category, setCategory] = useState<InventoryCategory>("rec");
  const activeCategory =
    INVENTORY_CATEGORIES.find((item) => item.id === category) ?? INVENTORY_CATEGORIES[0];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {header}
        {/* Top-level pill tabs, same style as Sports Fiesta / Inter University */}
        <nav
          aria-label="Inventory phases"
          className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {INVENTORY_PHASES.map((item) => {
            const active = phase === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setPhase(item.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-emerald-500 text-zinc-950 shadow-sm dark:bg-emerald-400"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-6">
        {/* Underline tabs, same style as Achievements / Athletic Records */}
        <nav
          aria-label="Inventory categories"
          className="inline-flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-white/10"
        >
          {INVENTORY_CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setCategory(item.id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-emerald-500 text-zinc-900 dark:border-emerald-400 dark:text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <InventorySection
          key={`${phase}-${activeCategory.id}`}
          title={`${INVENTORY_PHASES.find((p) => p.id === phase)?.label ?? ""} ${activeCategory.label}`}
          phase={phase}
          category={activeCategory.id}
          items={items.filter(
            (item) => item.phase === phase && item.category === activeCategory.id
          )}
          // CSV import updates Phase 01 Rec Inventory by item name.
          headerActions={
            phase === "phase_01" && activeCategory.id === "rec" ? importAction : null
          }
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function InventoryForm({
  item,
  phase,
  category,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  item?: InventoryItem;
  phase: InventoryPhase;
  category: InventoryCategory;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const idPrefix = item ? `inventory-${item.id}` : `inventory-new-${phase}-${category}`;

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="category" value={category} />
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Item name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={item?.name ?? ""}
          placeholder="Basketballs"
          required
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-quantity`}>Quantity</Label>
        <Input
          id={`${idPrefix}-quantity`}
          name="quantity"
          type="number"
          min="0"
          defaultValue={item?.quantity ?? ""}
          required
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {error && <p className="w-full text-sm text-red-600 dark:text-red-300">{error}</p>}
      </div>
    </form>
  );
}

function InventorySection({
  title,
  phase,
  category,
  items,
  headerActions,
  canEdit,
}: {
  title: string;
  phase: InventoryPhase;
  category: InventoryCategory;
  items: InventoryItem[];
  headerActions?: React.ReactNode;
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;
  const formOpen = showForm || editingItem !== null;
  const slug = `${phase}-${category}`;

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function openAdd() {
    closeForm();
    setShowForm(true);
  }

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addInventoryItem(formData);
      if (result.error) setError(result.error);
      else closeForm();
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateInventoryItem(formData);
      if (result.error) setError(result.error);
      else closeForm();
    });
  }

  function closeDelete() {
    if (pending) return;
    setDeletingItem(null);
    setError(null);
  }

  function confirmDelete() {
    if (!deletingItem) return;
    const item = deletingItem;
    setError(null);
    startTransition(async () => {
      const result = await deleteInventoryItem(item.id);
      if (result.error) setError(result.error);
      else {
        setDeletingItem(null);
        if (editingId === item.id) closeForm();
      }
    });
  }

  function exportCsv() {
    downloadCsv(
      `inventory-${csvFileSlug(slug)}.csv`,
      toCsv(
        ["Item", "Quantity", "Last updated"],
        filtered.map((item) => [
          blankCell(item.name),
          String(item.quantity),
          new Date(item.updated_at).toLocaleString(),
        ])
      )
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={exportCsv}
          >
            Export
          </Button>
          {headerActions}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1 max-w-md">
          <Label htmlFor={`inventory-search-${slug}`}>Search items</Label>
          <Input
            id={`inventory-search-${slug}`}
            placeholder="Item name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button type="button" className="ml-auto" onClick={openAdd}>
            Add item
          </Button>
        )}
      </div>

      {error && !formOpen && (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      )}

      <FormModal
        open={canEdit && showForm}
        title={`New item — ${title}`}
        titleId={`new-inventory-title-${slug}`}
        onClose={closeForm}
      >
        <InventoryForm
          key={`new-${slug}`}
          phase={phase}
          category={category}
          pending={pending}
          error={error}
          submitLabel="Save item"
          onSubmit={handleAdd}
          onCancel={closeForm}
        />
      </FormModal>

      <FormModal
        open={canEdit && editingItem !== null}
        title={`Edit item — ${editingItem?.name ?? ""}`}
        titleId={`edit-inventory-title-${slug}`}
        onClose={closeForm}
      >
        {editingItem ? (
          <InventoryForm
            key={editingItem.id}
            item={editingItem}
            phase={phase}
            category={category}
            pending={pending}
            error={error}
            submitLabel="Save changes"
            onSubmit={handleUpdate}
            onCancel={closeForm}
          />
        ) : null}
      </FormModal>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Item</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Quantity</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Last updated</th>
                {canEdit && (
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 4 : 3}
                    className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {query.trim() ? "No items match your search." : "No inventory items yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-white/10"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {new Date(item.updated_at).toLocaleString()}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(item.id);
                              setShowForm(false);
                              setError(null);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => {
                              setDeletingItem(item);
                              setError(null);
                            }}
                            disabled={pending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {filtered.length} item(s) in {title}
          {query.trim() ? " · matching search" : ""}
        </p>
      </Card>

      <ConfirmDialog
        open={canEdit && deletingItem !== null}
        title="Delete item?"
        titleId={`delete-inventory-title-${slug}`}
        description={
          <>
            <span className="font-medium text-zinc-900 dark:text-white">{deletingItem?.name}</span>{" "}
            will be permanently removed from {title}. This cannot be undone.
          </>
        }
        pending={pending}
        error={deletingItem ? error : null}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </section>
  );
}
