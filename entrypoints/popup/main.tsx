import { createRoot } from "react-dom/client";

import "@/assets/globals.css";
import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex w-80 flex-col gap-2 p-5">
      <h1 className="text-xl font-semibold tracking-tight">LinkedBack</h1>
      <p className="text-sm text-muted-foreground">
        Never lose a LinkedIn post again.
      </p>
      <Button asChild className="mt-2 self-start">
        <a href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer">
          Open LinkedIn
        </a>
      </Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
