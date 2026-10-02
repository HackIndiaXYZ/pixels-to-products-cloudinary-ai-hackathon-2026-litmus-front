# Seller Studio

A single-page product studio for small Indian sellers. One phone photo becomes a background-removed listing, a marketplace square, an Instagram post, and a Story, with optional festival text drawn by Cloudinary.

HackIndia Pixels to Products, Cloudinary AI Hackathon 2026. Track 3, a media-centric product. Team Litmus Front. Built solo by Kunal Dadlani (GitHub: Kayd-06).

Live demo: https://seller-studio-theta.vercel.app

## Problem

Sellers on Meesho, Instagram, and WhatsApp photograph products at home. The background is messy, the aspect ratio is wrong for the marketplace, and festival creative usually means another design tool. Seller Studio keeps the whole job on one Cloudinary delivery URL.

## Architecture

The Next.js App Router app lives only in `web/`. The repository root has no `package.json`.

| Path | Role |
| --- | --- |
| `web/app/page.tsx` | Server component. Sets the page title and renders `<Studio />`. |
| `web/app/studio.tsx` | The entire product. Client component (`"use client"`). |
| `web/app/layout.tsx` | Root layout and fonts. |
| `web/.env.local` | Local public Cloudinary config. Gitignored. |

There is one route, `/`. There is no auth, database, API route, or server upload. The browser uploads with an unsigned preset and then builds delivery URLs. React state holds the public id, backdrop, preview size, festival, and the three text fields. Nothing is stored after refresh.

Cloudinary surface area, all from `next-cloudinary`:

- `CldUploadWidget` for the unsigned upload
- `CldImage` for the original photo only
- `getCldImageUrl` for the backdrop delivery URL
- a plain `<img>` for the finished listing, so the SDK cannot append another resize after the pad

## Upload

The widget is configured in the browser. The preset comes from `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. The cloud name comes from `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. No API secret is read, and uploads are not signed.

| Option | Value |
| --- | --- |
| Sources | `local` only |
| Multiple | `false` |
| Max file size | 10 MB (`10000000`) |
| Formats | `jpg`, `jpeg`, `png`, `webp` |
| Folder | `seller-studio` |

`onSuccess` stores `result.info.public_id` only when `result.info` is an object, resets backdrop, size, festival, and text fields, then calls `close()`. A string `info` payload is ignored.

The original is rendered with `CldImage` at `width={1200}` `height={1600}` `crop="limit"` `gravity="auto"` and `className="h-auto w-full object-contain"`. The frame is `h-auto`. The whole product, cap to base, stays visible. On a phone the original is first and the listing is second (`grid-cols-1`, then `lg:grid-cols-2`).

## Delivery URL

Every listing URL is assembled in two steps.

1. `getCldImageUrl` builds the backdrop chain. `width: 800` and `height: 800` with no crop make the loader append `c_limit,w_800` after the raw components, default the version to `v1`, and add an analytics `?_a=` query. `f_auto,q_auto` inside the raw chain stops the loader from adding a second format and quality pair.
2. `finishDeliveryUrl` splices the size pad and any text layers into that URL. It removes the mid-chain `f_auto,q_auto` component and writes it again as the last transformation, immediately before `/v1/<public_id>`. The query string is preserved.

Text is not passed through `getCldImageUrl`. That helper `encodeURI`-encodes `rawTransformations`, so a component that already contains `%20` becomes `%2520`. Overlay copy is sanitized, passed through `encodeURIComponent` once, and inserted as a path component. Spaces stay `%20`.

A finished Instagram URL has this shape:

```text
https://res.cloudinary.com/<cloud>/image/upload/
  <backdrop components without f_auto,q_auto>/
  c_limit,w_800/
  c_pad,w_1080,h_1350,b_white,g_center/
  l_text:.../
  f_auto,q_auto/
  v1/<public_id>?<analytics>
```

### Studio white

```text
e_background_removal / e_dropshadow / b_white / f_auto,q_auto
```

Background removal runs first, while the pixels are still a photo. Drop shadow runs on the transparent cutout. `b_white` then fills the canvas. This is the default backdrop.

### Marble counter and Soft daylight room

Generative background replace (`e_gen_background_replace`) is not used. It is unavailable in Cloudinary's Asia Pacific region. Both scenic backdrops are a cutout composited on a fetched image.

The remote image URL is `btoa`'d and made URL-safe (`+` to `-`, `/` to `_`). That token is the `u_fetch` source. The Unsplash URLs themselves are constants in `studio.tsx`.

Component order:

```text
e_background_removal
c_scale,w_0.55
e_dropshadow
u_fetch:<url-safe base64>,c_fill,w_1.0,h_1.0,fl_relative
fl_layer_apply,g_center
f_auto,q_auto
```

That order is load-bearing:

- Transformations between `u_fetch` and `fl_layer_apply` affect the underlay, not the product. `c_scale,w_0.55` is therefore before the underlay, so the product shrinks to 55% and the backdrop can show around it. The same scale after `u_fetch` and before `fl_layer_apply` would shrink the backdrop into a tile.
- `e_dropshadow` must run while the cutout is still transparent. Running it after a full-bleed underlay returns HTTP 400, `Cannot apply dropshadow effect on non-transparent image`.
- `c_fill,w_1.0,h_1.0,fl_relative` sizes the fetched photo to the base image. `fl_relative` is required. Without it, `w_1.0` means 100% of the overlay's own width.
- `fl_layer_apply,g_center` paints that backdrop behind the product. The product stays on top.

### Size pad

The preview has its own size control. Each size is the current backdrop URL plus one pad component. The pad does not rebuild the backdrop chain.

| Preview size | Component |
| --- | --- |
| Square 1080 | `c_pad,w_1080,h_1080,b_white,g_center` |
| Instagram post 1080×1350 | `c_pad,w_1080,h_1350,b_white,g_center` |
| Story 1080×1920 | `c_pad,w_1080,h_1920,b_white,g_center` |

`c_pad` with `b_white` and `g_center` letterboxes the cutout. It does not crop it. White bars appear on the short axis.

Changing size or backdrop does not call a new AI effect. Background removal is already in the shared chain. Only the selected backdrop URL is fetched.

### Festival text

Three inputs sit under the festival chips: product name, price, and offer. Each is capped at 28 characters. Commas, single and double quotes, slashes, and colons are stripped before encoding, because those characters delimit Cloudinary components. The stored value stays editable.

| Festival | Offer filled in | Text color |
| --- | --- | --- |
| None | cleared | no text layers |
| Diwali | `Diwali Sale` | `co_rgb:7c2d12` |
| Navratri | `Navratri Sale` | `co_rgb:9a3412` |
| Dussehra | `Dussehra Sale` | `co_rgb:7c2d12` |
| Raksha Bandhan | `Raksha Bandhan` | `co_rgb:9f1239` |
| Eid | `Eid Sale` | `co_rgb:14532d` |
| Christmas | `Christmas Sale` | `co_rgb:14532d` |

None means no `l_text` components, even if the fields still hold text. Empty fields are omitted. When a festival is selected, non-empty fields are appended after `c_pad` and before `f_auto,q_auto`, in this order:

```text
l_text:Arial_48_bold:<name>,co_rgb:<color>,g_north,y_48
l_text:Arial_32_bold:<price>,co_rgb:<color>,g_south_west,x_48,y_48
l_text:Arial_32:<offer>,co_rgb:<color>,g_south_east,x_48,y_48
```

The name is Arial bold, centered on the top edge. The price is Arial bold at the bottom left. The offer is regular Arial at the bottom right. `y_48` and `x_48` are positive insets so the glyphs sit on the padded canvas instead of on the cutout or against the frame edge. A tall product in a square still has little top padding, so the name can overlap the product on Square even though the layer is after `c_pad`. Story and the Instagram post have a larger white band.

48px and 32px are chosen so a 28-character line fits a 1080-wide canvas. The previous fixed Diwali strings (`Arial_72` / `Arial_42`, "Free delivery") are gone.

If a text URL returns HTTP 400, the status and the first 180 characters of the body stay on screen, and the same size is shown again without text layers.

### Format and quality

`f_auto,q_auto` is the last transformation component of every listing URL: preview, Meesho, Instagram post, and Story. It is one component, the same token already used in the backdrop chains, not a split `f_auto/q_auto`.

## Preview and download

The listing frame is `h-auto` with overflow visible. The image is `h-auto w-full object-contain`. There is no fixed height, `overflow-hidden`, or `object-cover` on the result. The loading placeholder uses `aspect-square` only while there is no image yet.

Downloads fetch the composed URL with `cache: "no-store"`, turn the body into a blob, and click a temporary `<a download>`. No new tab.

| Button | Canvas | Text | Filename |
| --- | --- | --- | --- |
| Meesho | `c_pad,w_1080,h_1080,b_white,g_center` | never | `meesho.png` |
| Instagram post | `c_pad,w_1080,h_1350,b_white,g_center` | festival text, if any | `instagram-post.png` |
| Story | `c_pad,w_1080,h_1920,b_white,g_center` | festival text, if any | `story.png` |

All three use the backdrop that is currently selected. Meesho is always the square pad and never contains `l_text`, including when a festival is selected and the preview is showing text.

## Derivative retry

Background removal and the fetched underlay are generated on first request. Cloudinary answers HTTP 423 while the derivative is locked, and it can also return HTTP 200 with an empty body.

One effect polls the selected delivery URL:

- up to 10 attempts
- 3 seconds between attempts
- `cache: "no-store"`
- the timer is cleared on cleanup
- ready and error state are keyed by public id and full URL, so switching backdrop, size, or text does not flash the previous image

Any other non-OK status sets the message to the status code plus the first 180 characters of the body. After 10 attempts the UI says the image is still processing and offers Try again, which bumps a nonce and restarts the same loop.

## Local development

Run commands from `web/`, not the repository root. `npm run dev` at the root has no app to start. Open http://localhost:3000. Paths such as `/page`, `/studio`, and `/index` are not routes and return Next's 404.

```bash
cd web
npm install
```

Create `web/.env.local` (it is gitignored):

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud name>
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<unsigned preset>
```

The preset must be unsigned and must allow the folder `seller-studio`. Then:

```bash
npm run dev
```

Typecheck from `web/`:

```bash
npx tsc --noEmit
```

Do not run `npx tsc` from the repository root. npm will treat `tsc` as a package name.

## Deploy

The Vercel project uses root directory `web`. Set the same two `NEXT_PUBLIC_` variables in the Vercel project. Do not commit `.env.local`. `web/.gitignore` also ignores `.vercel`.

## Stack

| Piece | Version / note |
| --- | --- |
| Next.js | 16.3.6, App Router, Turbopack in dev |
| React | 19.2.8 |
| next-cloudinary | 6.19.3 |
| Tailwind CSS | 4 |
| TypeScript | 5, `strict` |
| Hosting | Vercel, root directory `web` |

Cloudinary skills used while building this live in `web/.agents/skills`: `cloudinary-docs`, `cloudinary-next`, `cloudinary-react`, and `cloudinary-transformations`.

## Out of scope

No second Cloudinary cloud, no sample-photo gallery, no Hindi overlays, no signed upload, no upload API route, and no `e_gen_background_replace`.
