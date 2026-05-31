import { ImportClient } from "@/components/import-client";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Import data</h2>
        <p className="mt-1 text-zinc-600">
          Bulk upload existing spreadsheets. Download a template, fill it in, then upload.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
