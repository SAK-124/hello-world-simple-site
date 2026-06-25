import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hello World" },
      { name: "description", content: "A simple hello world page." },
      { property: "og:title", content: "Hello World" },
      { property: "og:description", content: "A simple hello world page." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-medium">hello world</h1>
    </div>
  );
}

