# Seller Studio

A product marketing studio for small Indian sellers. One phone photo becomes a clean marketplace listing and a festival poster.

HackIndia Pixels to Products, Cloudinary AI Hackathon 2026. Track 3, a media-centric product. Team Litmus Front. Built solo by Kunal Dadlani (GitHub: Kayd-06).

Live demo: https://seller-studio-theta.vercel.app

## The problem

Sellers on Meesho, Instagram, and WhatsApp shoot products at home. The photo has a messy background, the wrong size, and no festival creative. Studios and design tools cost more than the product.

## What it does

- Upload one product photo with Cloudinary's unsigned upload widget.
- Remove the background and add a drop shadow on white (`e_background_removal`, `e_dropshadow`).
- Place the cutout on a marble counter or a daylight room.
- Export Square (1080), Instagram post (1080x1350), or Story (1080x1920).
- Turn on a Diwali poster with "Diwali Sale" and "Free delivery" as Cloudinary text overlays.

Generative background replace is not available in Cloudinary's Asia Pacific region, so the backdrops are Cloudinary underlays composited with the cutout.

## How Cloudinary is used

The Next.js app uses `next-cloudinary` and Cloudinary's Skills Pack (`cloudinary-docs`, `cloudinary-next`, `cloudinary-react`, `cloudinary-transformations` in `web/.agents/skills`). Cloud name and the unsigned preset `seller_studio` are public env vars. No API secret is in the repo.

## How to test

1. Open the live demo.
2. Upload a product photo (JPG, PNG, or WEBP, under 10 MB).
3. Wait for the cleaned image. The first request can take a few seconds.
4. Switch backdrop, size, and the Diwali poster.
5. Download the result.

Locally, from `web`: copy `.env.example` if present, or create `.env.local` with `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, then `npm install` and `npm run dev`.

## Stack

Next.js App Router, Tailwind, next-cloudinary, deployed on Vercel with root directory `web`.