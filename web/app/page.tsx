import type { Metadata } from "next";
import Studio from "./studio";

export const metadata: Metadata = {
  title: "Seller studio",
  description:
    "Upload a product photo, remove the background, and download a cleaned image.",
};

export default function Home() {
  return <Studio />;
}
