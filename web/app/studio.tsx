"use client";

import { useEffect, useState } from "react";
import { CldImage, CldUploadWidget, getCldImageUrl } from "next-cloudinary";

const CLEANED_RAW_TRANSFORMATIONS = [
  "e_background_removal",
  "e_dropshadow",
  "b_white",
  "f_auto,q_auto",
];

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 3000;

function cleanedDeliveryUrl(publicId: string) {
  return getCldImageUrl({
    src: publicId,
    width: 800,
    height: 800,
    rawTransformations: CLEANED_RAW_TRANSFORMATIONS,
  });
}

function tryCleanedDeliveryUrl(publicId: string) {
  try {
    return cleanedDeliveryUrl(publicId);
  } catch {
    return null;
  }
}

export default function Studio() {
  const [publicId, setPublicId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [ready, setReady] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const deliveryUrl = publicId ? tryCleanedDeliveryUrl(publicId) : null;
  const cleanedUrl = publicId && ready?.id === publicId ? ready.url : null;
  const errorMessage =
    publicId && !deliveryUrl
      ? "Couldn't prepare the cleaned image."
      : publicId && error?.id === publicId
        ? error.message
        : null;

  useEffect(() => {
    if (!publicId || !deliveryUrl) {
      return;
    }

    const imageId = publicId;
    const url = deliveryUrl;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleRetry(currentAttempt: number) {
      if (cancelled) {
        return;
      }
      if (currentAttempt >= MAX_ATTEMPTS) {
        setError({ id: imageId, message: "Still processing. Try again." });
        return;
      }
      timer = setTimeout(() => {
        void poll(currentAttempt + 1);
      }, RETRY_DELAY_MS);
    }

    async function poll(currentAttempt: number) {
      if (cancelled) {
        return;
      }
      setAttempt(currentAttempt);
      setError((current) => (current?.id === imageId ? null : current));

      try {
        const response = await fetch(url, { cache: "no-store" });
        if (cancelled) {
          return;
        }

        if (response.status === 423) {
          scheduleRetry(currentAttempt);
          return;
        }

        if (response.ok) {
          const body = await response.arrayBuffer();
          if (cancelled) {
            return;
          }
          if (response.status === 200 && body.byteLength === 0) {
            scheduleRetry(currentAttempt);
            return;
          }
          setReady({ id: imageId, url });
          return;
        }

        setError({
          id: imageId,
          message: "Couldn't prepare the cleaned image.",
        });
      } catch {
        if (!cancelled) {
          setError({
            id: imageId,
            message: "Couldn't prepare the cleaned image.",
          });
        }
      }
    }

    void poll(1);

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [publicId, deliveryUrl, retryNonce]);

  async function downloadCleanedImage() {
    if (!cleanedUrl || !publicId) {
      return;
    }

    try {
      const response = await fetch(cleanedUrl, { cache: "no-store" });
      if (!response.ok) {
        setDownloadError("Couldn't download the cleaned image.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "cleaned-product.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloadError(null);
    } catch {
      setDownloadError("Couldn't download the cleaned image.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 font-sans md:px-8 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Seller studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Product photo
        </h1>
        <p className="max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Upload one product photo. The cleaned version removes the background,
          adds a drop shadow, and sits on white.
        </p>
      </header>

      <CldUploadWidget
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
        options={{
          sources: ["local"],
          multiple: false,
          maxFileSize: 10000000,
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          folder: "seller-studio",
        }}
        onSuccess={(result, { close }) => {
          if (typeof result.info === "object" && result.info) {
            setDownloadError(null);
            setReady(null);
            setError(null);
            setAttempt(1);
            setPublicId(result.info.public_id);
            setRetryNonce((current) => current + 1);
            close();
          }
        }}
      >
        {({ open, isLoading }) => (
          <button
            type="button"
            onClick={() => open()}
            disabled={isLoading}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40 md:w-fit"
          >
            Upload product photo
          </button>
        )}
      </CldUploadWidget>

      {!publicId ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 px-5 py-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No photo yet. Upload a product photo to compare the original and the
          cleaned version.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <figure className="flex flex-col gap-3">
            <figcaption className="text-sm font-medium text-foreground">
              Original
            </figcaption>
            <CldImage
              src={publicId}
              width={800}
              height={800}
              sizes="(max-width: 768px) 100vw, 400px"
              crop="fill"
              gravity="auto"
              alt="Original product photo"
              className="h-auto w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900"
            />
          </figure>

          <figure className="flex flex-col gap-3">
            <figcaption className="text-sm font-medium text-foreground">
              Cleaned
            </figcaption>
            {cleanedUrl ? (
              <CldImage
                src={publicId}
                width={800}
                height={800}
                sizes="(max-width: 768px) 100vw, 400px"
                rawTransformations={CLEANED_RAW_TRANSFORMATIONS}
                alt="Product with background removed"
                className="h-auto w-full rounded-2xl bg-white"
              />
            ) : (
              <div
                className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-100 px-6 text-center text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                aria-live="polite"
              >
                {errorMessage ? (
                  <div className="flex flex-col items-center gap-3">
                    <p>{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAttempt(1);
                        setError(null);
                        setRetryNonce((current) => current + 1);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-foreground dark:border-zinc-700"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <p>Processing (attempt {attempt} of 10)</p>
                )}
              </div>
            )}
          </figure>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => void downloadCleanedImage()}
          disabled={!cleanedUrl}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40 md:w-fit dark:border-zinc-700"
        >
          Download cleaned image
        </button>
        {downloadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{downloadError}</p>
        ) : null}
      </div>
    </main>
  );
}
