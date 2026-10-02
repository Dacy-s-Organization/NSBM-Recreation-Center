"use client";

import { useState, useTransition } from "react";
import { getCertificateImage } from "@/app/actions/certificates";
import { previewableCertificate, type IssuedCertificateMeta } from "@/lib/certificates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CertificateList({
  certificates,
}: {
  certificates: (IssuedCertificateMeta & { reference_no?: string })[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [image, setImage] = useState<{
    file_name: string;
    content_type: string;
    image_base64: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (certificates.length === 0) return <span className="text-zinc-400">—</span>;

  function open(id: string) {
    setOpenId(id);
    setImage(null);
    setError(null);
    startTransition(async () => {
      const result = await getCertificateImage(id);
      if ("error" in result) setError(result.error);
      else setImage(result.image);
    });
  }

  const preview = image && previewableCertificate(image.content_type);
  const href = image ? `data:${image.content_type};base64,${image.image_base64}` : undefined;

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        {certificates.map((file) => (
          <button
            key={file.id}
            type="button"
            className="text-left text-sm text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
            onClick={() => open(file.id)}
          >
            {file.file_name}
            {file.reference_no ? ` (${file.reference_no})` : ""}
          </button>
        ))}
      </div>
      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-medium text-zinc-900 dark:text-white">
                {image?.file_name ?? "Certificate"}
              </p>
              <Button type="button" variant="secondary" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
            {pending && <p className="text-sm text-zinc-500">Loading certificate…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {preview && href && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={href} alt={image.file_name} className="max-h-[70vh] w-full object-contain" />
            )}
            {image && !preview && href && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This image format opens as a download.
              </p>
            )}
            {href && (
              <a
                className="mt-3 inline-block text-sm text-sky-700 underline dark:text-sky-300"
                href={href}
                download={image?.file_name ?? "certificate"}
              >
                Download
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CertificateFields({
  existing,
  referenceNo,
  idPrefix,
}: {
  existing?: IssuedCertificateMeta[];
  referenceNo?: string;
  idPrefix: string;
}) {
  return (
    <div className="sm:col-span-2 space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-reference`}>Reference no</Label>
        <Input
          id={`${idPrefix}-reference`}
          name="reference_no"
          defaultValue={referenceNo ?? ""}
          placeholder="AA00001"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Leave blank and the next AA number is assigned. Type one only when the certificate was already issued.
        </p>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-certificates`}>Certificates</Label>
        <input
          id={`${idPrefix}-certificates`}
          name="certificates"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/heif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.heif,.heic"
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm dark:text-zinc-200 dark:file:bg-white/10"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Jpeg, png, webp, gif, or heif. Each file must be 4 MB or smaller.
        </p>
      </div>
      {existing && existing.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Remove on save</p>
          {existing.map((file) => (
            <label key={file.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_certificate" value={file.id} />
              {file.file_name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
