"use client";

import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/format";

export function InventoryClient({
  items,
  canEdit,
}: {
  items: InventoryItem[];
  canEdit: boolean;
}) {
  const [phase, setPhase] = useState<InventoryPhase>("phase_01");
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    const formId = String(formData.get("form_id") ?? "");
    startTransition(async () => {
      const result = await addInventoryItem(formData);
      if (result.error) setError(result.error);
      else {
        setAddingKey(null);
        (document.getElementById(formId) as HTMLFormElement | null)?.reset();
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateInventoryItem(formData);
      if (result.error) setError(result.error);
      else setEditingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete inventory item "${name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteInventoryItem(id);
      if (result.error) setError(result.error);
      else if (editingId === id) setEditingId(null);
    });
  }

  function selectPhase(next: InventoryPhase) {
    setPhase(next);
    setAddingKey(null);
    setEditingId(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Inventory phase"
        className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
      >
        {INVENTORY_PHASES.map((item) => {
          const selected = phase === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectPhase(item.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                selected
                  ? "bg-emerald-500 text-zinc-950 shadow-sm dark:bg-emerald-400"
                  : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="space-y-8">
        {INVENTORY_CATEGORIES.map((category) => (
          <InventorySection
            key={category.id}
            title={category.label}
            phase={phase}
            category={category.id}
            items={items.filter(
              (item) => item.phase === phase && item.category === category.id
            )}
            canEdit={canEdit}
            adding={addingKey === `${phase}-${category.id}`}
            editingId={editingId}
            pending={pending}
            onToggleAdd={() => {
              setError(null);
              setEditingId(null);
              setAddingKey((current) =>
                current === `${phase}-${category.id}` ? null : `${phase}-${category.id}`
              );
            }}
            onEdit={(id) => {
              setAddingKey(null);
              setEditingId(id);
              setError(null);
            }}
            onCancelEdit={() => setEditingId(null)}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function InventorySection({
  title,
  phase,
  category,
  items,
  canEdit,
  adding,
  editingId,
  pending,
  onToggleAdd,
  onEdit,
  onCancelEdit,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string;
  phase: InventoryPhase;
  category: InventoryCategory;
  items: InventoryItem[];
  canEdit: boolean;
  adding: boolean;
  editingId: string | null;
  pending: boolean;
  onToggleAdd: () => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onAdd: (formData: FormData) => void;
  onUpdate: (formData: FormData) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const formId = `add-inventory-${phase}-${category}`;
  const nameId = `name-${phase}-${category}`;
  const quantityId = `quantity-${phase}-${category}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        {canEdit && (
          <Button type="button" onClick={onToggleAdd}>
            {adding ? "Cancel" : "Add item"}
          </Button>
        )}
      </div>

      {canEdit && adding && (
        <Card>
          <h4 className="font-medium text-zinc-900 dark:text-white">New inventory item</h4>
          <form id={formId} action={onAdd} className="mt-4 flex flex-wrap items-end gap-4">
            <input type="hidden" name="form_id" value={formId} />
            <input type="hidden" name="phase" value={phase} />
            <input type="hidden" name="category" value={category} />
            <div className="min-w-[200px] flex-1">
              <Label htmlFor={nameId}>Item name</Label>
              <Input id={nameId} name="name" placeholder="Basketballs" required />
            </div>
            <div className="w-32">
              <Label htmlFor={quantityId}>Quantity</Label>
              <Input id={quantityId} name="quantity" type="number" min="0" required />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </form>
        </Card>
      )}

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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No inventory items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-white/10">
                    {canEdit && editingId === item.id ? (
                      <td colSpan={4} className="px-4 py-3">
                        <form action={onUpdate} className="flex flex-wrap items-end gap-3">
                          <input type="hidden" name="id" value={item.id} />
                          <div className="min-w-[180px] flex-1">
                            <Label>Name</Label>
                            <Input name="name" defaultValue={item.name} required />
                          </div>
                          <div className="w-28">
                            <Label>Qty</Label>
                            <Input
                              name="quantity"
                              type="number"
                              min="0"
                              defaultValue={item.quantity}
                              required
                            />
                          </div>
                          <Button type="submit" disabled={pending}>
                            Save
                          </Button>
                          <Button type="button" variant="secondary" onClick={onCancelEdit}>
                            Cancel
                          </Button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{item.name}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="ghost" onClick={() => onEdit(item.id)}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => onDelete(item.id, item.name)}
                                disabled={pending}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
