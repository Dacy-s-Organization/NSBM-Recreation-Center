"use client";

import { useState, useTransition } from "react";
import {
  addInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/app/actions/inventory";
import type { InventoryItem } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function InventoryClient({ items }: { items: InventoryItem[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addInventoryItem(formData);
      if (result.error) setError(result.error);
      else {
        setShowAdd(false);
        (document.getElementById("add-inventory-form") as HTMLFormElement)?.reset();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add item"}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {showAdd && (
        <Card>
          <h3 className="font-medium text-zinc-900 dark:text-white">New inventory item</h3>
          <form
            id="add-inventory-form"
            action={handleAdd}
            className="mt-4 flex flex-wrap items-end gap-4"
          >
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="name">Item name</Label>
              <Input id="name" name="name" placeholder="Basketballs" required />
            </div>
            <div className="w-32">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" min="0" required />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
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
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No inventory items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-white/10">
                    {editingId === item.id ? (
                      <td colSpan={4} className="px-4 py-3">
                        <form
                          action={handleUpdate}
                          className="flex flex-wrap items-end gap-3"
                        >
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
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
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
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setEditingId(item.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={pending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
