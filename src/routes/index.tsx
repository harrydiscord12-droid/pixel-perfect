import { createFileRoute } from "@tanstack/react-router";
import { GlassReel } from "@/components/GlassReel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Making — A Glass Typography Reel" },
      { name: "description", content: "An interactive, cinematic glass typography reel of game genres." },
      { property: "og:title", content: "Making — A Glass Typography Reel" },
      { property: "og:description", content: "Scroll, drag or tap through game genres floating in glass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">Making games — interactive genre reel</h1>
      <GlassReel />
    </main>
  );
}
