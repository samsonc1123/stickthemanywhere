import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ConvexReactClient, ConvexProvider } from "convex/react";

const convexUrl = "https://gregarious-porpoise-625.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

console.log("CONVEX_URL used:", convexUrl);

const rootElement = document.getElementById("root")!;
if (!(rootElement as any)._reactRoot) {
  const root = createRoot(rootElement);
  (rootElement as any)._reactRoot = root;
  root.render(
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConvexProvider>
  );
} else {
  (rootElement as any)._reactRoot.render(
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConvexProvider>
  );
}
