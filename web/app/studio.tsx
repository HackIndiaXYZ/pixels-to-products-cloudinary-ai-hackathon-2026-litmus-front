"use client";

import { useEffect, useState } from "react";
import { CldImage, CldUploadWidget, getCldImageUrl } from "next-cloudinary";

const CLEANED_RAW_TRANSFORMATIONS = [
  "e_background_removal",
  "e_dropshadow",
  "b_white",
  "f_auto,q_auto",
];

const MARBLE_BACKDROP =
  "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1200&q=80";
const DAYLIGHT_BACKDROP =
  "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80";

const BACKDROPS = [
  { id: "studio-white", label: "Studio white" },
  { id: "marble", label: "Marble counter" },
  { id: "daylight", label: "Soft daylight room" },
] as const;

type BackdropId = (typeof BACKDROPS)[number]["id"];

const SIZES = [
  {
    id: "square",
    label: "Square 1080",
    pad: "c_pad,w_1080,h_1080,b_white,g_center",
  },
  {
    id: "instagram",
    label: "Instagram post 1080x1350",
    pad: "c_pad,w_1080,h_1350,b_white,g_center",
  },
  {
    id: "story",
    label: "Story 1080x1920",
    pad: "c_pad,w_1080,h_1920,b_white,g_center",
  },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

const DIWALI_TEXT_LAYERS = [
  "l_text:Arial_72_bold:Diwali%20Sale,co_rgb:7c2d12,g_north,y_48",
  "l_text:Arial_42:Free%20delivery,co_rgb:7c2d12,g_south,y_48",
] as const;

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 3000;

function cloudinaryBase64(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_");
}

function backdropRawTransformations(imageUrl: string) {
  const fetched = cloudinaryBase64(imageUrl);
  return [
    "e_background_removal",
    "c_scale,w_0.55",
    "e_dropshadow",
    `u_fetch:${fetched},c_fill,w_1.0,h_1.0,fl_relative`,
    "fl_layer_apply,g_center",
    "f_auto,q_auto",
  ];
}

function cleanedDeliveryUrl(publicId: string) {
  return getCldImageUrl({
    src: publicId,
    width: 800,
    height: 800,
    rawTransformations: CLEANED_RAW_TRANSFORMATIONS,
  });
}

function generatedDeliveryUrl(publicId: string, imageUrl: string) {
  return getCldImageUrl({
    src: publicId,
    width: 800,
    height: 800,
    rawTransformations: backdropRawTransformations(imageUrl),
  });
}

function tryCleanedDeliveryUrl(publicId: string) {
  try {
    return cleanedDeliveryUrl(publicId);
  } catch {
    return null;
  }
}

function tryGeneratedDeliveryUrl(publicId: string, imageUrl: string) {
  try {
    return generatedDeliveryUrl(publicId, imageUrl);
  } catch {
    return null;
  }
}

function backdropImageFor(backdrop: BackdropId) {
  if (backdrop === "marble") {
    return MARBLE_BACKDROP;
  }
  if (backdrop === "daylight") {
    return DAYLIGHT_BACKDROP;
  }
  return null;
}

function appendTransformations(url: string, extras: readonly string[]) {
  if (extras.length === 0) {
    return url;
  }
  const marker = "/image/upload/";
  const start = url.indexOf(marker);
  if (start === -1) {
    return url;
  }
  const head = url.slice(0, start + marker.length);
  const tail = url.slice(start + marker.length);
  const queryIndex = tail.indexOf("?");
  const path = queryIndex === -1 ? tail : tail.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : tail.slice(queryIndex);
  const versionMatch = /\/v\d+\//.exec(path);
  if (!versionMatch || versionMatch.index === undefined) {
    return url;
  }
  const chain = path.slice(0, versionMatch.index);
  const rest = path.slice(versionMatch.index);
  return `${head}${chain}/${extras.join("/")}${rest}${query}`;
}

function chipClass(selected: boolean) {
  return selected
    ? "inline-flex h-10 max-w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-black"
    : "inline-flex h-10 max-w-full items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-medium text-white";
}

function listingAlt(backdrop: BackdropId, withPoster: boolean) {
  if (withPoster) {
    return "Diwali poster";
  }
  if (backdrop === "marble") {
    return "Product on a marble counter";
  }
  if (backdrop === "daylight") {
    return "Product in a soft daylight room";
  }
  return "Product with background removed";
}

export default function Studio() {
  const [publicId, setPublicId] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<BackdropId>("studio-white");
  const [size, setSize] = useState<SizeId>("square");
  const [poster, setPoster] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [ready, setReady] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<{
    id: string;
    url: string;
    message: string;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const selectedBackdrop = backdropImageFor(backdrop);
  const selectedSize = SIZES.find((option) => option.id === size) ?? SIZES[0];
  const backdropUrl = !publicId
    ? null
    : selectedBackdrop
      ? tryGeneratedDeliveryUrl(publicId, selectedBackdrop)
      : tryCleanedDeliveryUrl(publicId);
  const sizeUrl = backdropUrl
    ? appendTransformations(backdropUrl, [selectedSize.pad])
    : null;
  const posterUrl = backdropUrl
    ? appendTransformations(backdropUrl, [
        selectedSize.pad,
        ...DIWALI_TEXT_LAYERS,
      ])
    : null;
  const deliveryUrl = poster ? posterUrl : sizeUrl;
  const cleanedUrl =
    publicId && ready?.id === publicId && ready.url === deliveryUrl
      ? ready.url
      : null;
  const errorMessage =
    publicId && !deliveryUrl
      ? "Couldn't prepare the cleaned image."
      : publicId && error?.id === publicId && error.url === deliveryUrl
        ? error.message
        : null;
  const posterTextFailed = Boolean(
    poster && sizeUrl && errorMessage?.startsWith("400"),
  );
  const visibleUrl = cleanedUrl ?? (posterTextFailed ? sizeUrl : null);

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
        setError({
          id: imageId,
          url,
          message: "Still processing. Try again.",
        });
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

        const rawBody = await response.text();
        if (cancelled) {
          return;
        }
        setError({
          id: imageId,
          url,
          message: `${response.status} ${rawBody.slice(0, 180)}`,
        });
      } catch {
        if (!cancelled) {
          setError({
            id: imageId,
            url,
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
    if (!visibleUrl || !publicId) {
      return;
    }

    const filename =
      poster && visibleUrl === posterUrl
        ? `poster-${size}.png`
        : `listing-${size}.png`;

    try {
      const response = await fetch(visibleUrl, { cache: "no-store" });
      if (!response.ok) {
        setDownloadError("Couldn't download the cleaned image.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloadError(null);
    } catch {
      setDownloadError("Couldn't download the cleaned image.");
    }
  }

  function retryDelivery() {
    setAttempt(1);
    setError(null);
    setRetryNonce((current) => current + 1);
  }

  return (
    <main className="min-h-dvh bg-[#0c0c0c] font-sans text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-tight">Seller Studio</p>
          <p className="max-w-full rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
            For Instagram, Meesho and WhatsApp
          </p>
        </header>

        {!publicId ? (
          <section className="flex flex-1 flex-col justify-center gap-8 py-12">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight">
                One phone photo. A listing and a poster.
              </h1>
              <p className="mt-4 text-base leading-7 text-white/70">
                Made for small Indian sellers. Drop a product photo. Get a clean
                marketplace image and festival-ready backdrops.
              </p>
            </div>

            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-white/15 px-6">
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
                    setBackdrop("studio-white");
                    setSize("square");
                    setPoster(false);
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
                    className="inline-flex h-12 max-w-full items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-[#0c0c0c] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Upload product photo
                  </button>
                )}
              </CldUploadWidget>
            </div>

            <ul className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:gap-8">
              <li>Background removed</li>
              <li>AI backdrops</li>
              <li>Ready to download</li>
            </ul>
          </section>
        ) : (
          <section className="flex flex-col gap-8 pt-10">
            <div className="grid min-w-0 max-w-6xl grid-cols-1 items-start gap-8 overflow-visible lg:grid-cols-2">
              <figure className="flex min-w-0 flex-col gap-3">
                <figcaption className="text-sm font-medium text-white/70">
                  Original
                </figcaption>
                <div className="h-auto rounded-xl bg-white/5">
                  <CldImage
                    src={publicId}
                    width={1200}
                    height={1600}
                    sizes="(max-width: 768px) 100vw, 400px"
                    crop="limit"
                    gravity="auto"
                    alt="Original product photo"
                    className="h-auto w-full object-contain"
                  />
                </div>
              </figure>

              <figure className="flex h-auto min-w-0 flex-col gap-3 overflow-visible">
                <figcaption className="text-sm font-medium text-white/70">
                  Listing image
                </figcaption>
                {visibleUrl ? (
                  <div className="flex h-auto flex-col gap-3 overflow-visible">
                    <div
                      className="h-auto w-full overflow-visible rounded-xl bg-white/5"
                      style={{ height: "auto", overflow: "visible", maxHeight: "none" }}
                    >
                      {/* Delivery URL already ends in the size pad. CldImage would append another resize. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={visibleUrl}
                        alt={listingAlt(
                          backdrop,
                          poster && visibleUrl === posterUrl,
                        )}
                        className="h-auto w-full object-contain"
                        style={{
                          height: "auto",
                          width: "100%",
                          objectFit: "contain",
                          maxHeight: "none",
                        }}
                      />
                    </div>
                    {posterTextFailed && errorMessage ? (
                      <div className="flex flex-col items-start gap-3">
                        <p className="max-w-full break-all text-left text-xs text-white">
                          {errorMessage}
                        </p>
                        <button
                          type="button"
                          onClick={retryDelivery}
                          className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-white/70"
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className="flex aspect-square items-center justify-center rounded-xl bg-white/5 px-6 text-center"
                    aria-live="polite"
                  >
                    {errorMessage ? (
                      <div className="flex flex-col items-center gap-3">
                        <p className="max-w-full break-all text-left text-xs text-white">
                          {errorMessage}
                        </p>
                        <button
                          type="button"
                          onClick={retryDelivery}
                          className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-white/70"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-base font-medium">
                          {backdrop === "studio-white"
                            ? "Removing the background…"
                            : "Making the backdrop…"}
                        </p>
                        <p className="text-sm text-white/70">
                          Attempt {attempt} of 10
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <p className="text-sm text-white/60">Backdrop</p>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Backdrop"
                  >
                    {BACKDROPS.map((option) => {
                      const selected = backdrop === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            if (option.id === backdrop) {
                              return;
                            }
                            setAttempt(1);
                            setError(null);
                            setDownloadError(null);
                            setBackdrop(option.id);
                          }}
                          className={chipClass(selected)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm text-white/60">Size</p>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Size"
                  >
                    {SIZES.map((option) => {
                      const selected = size === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            if (option.id === size) {
                              return;
                            }
                            setAttempt(1);
                            setError(null);
                            setDownloadError(null);
                            setSize(option.id);
                          }}
                          className={chipClass(selected)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  aria-pressed={poster}
                  onClick={() => {
                    setAttempt(1);
                    setError(null);
                    setDownloadError(null);
                    setPoster((current) => !current);
                  }}
                  className={chipClass(poster)}
                >
                  Diwali poster
                </button>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <button
                    type="button"
                    onClick={() => void downloadCleanedImage()}
                    disabled={!visibleUrl}
                    className="inline-flex h-11 max-w-full items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-[#0c0c0c] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Download listing image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadError(null);
                      setReady(null);
                      setError(null);
                      setAttempt(1);
                      setBackdrop("studio-white");
                      setSize("square");
                      setPoster(false);
                      setPublicId(null);
                    }}
                    className="text-sm font-medium text-white/70"
                  >
                    Upload a different photo
                  </button>
                  {downloadError ? (
                    <p className="w-full text-sm text-red-300">{downloadError}</p>
                  ) : null}
                </div>
              </figure>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
