import { ShowcaseEnvironment } from "@/components/showcase/ShowcaseEnvironment";

export const metadata = {
  title: "Codex Web UI — Isolated Showcase",
  description: "The production Codex Web UI running against synthetic showcase data.",
};

export default function ShowcasePage() {
  return <ShowcaseEnvironment />;
}
