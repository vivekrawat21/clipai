"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Plug, RotateCcw, Settings2 } from "lucide-react";
import type { SocialAccount } from "@/lib/types";
import { data, USE_MOCK, API_BASE_URL } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLocalStorage } from "@/lib/use-local-storage";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = ["#ffffff", "#ffd60a", "#ff5d8f", "#48cae4", "#b388ff"];

export default function SettingsPage() {
  const { toast } = useToast();

  // Caption defaults (local preferences).
  const [fontSize, setFontSize] = useLocalStorage<number>("clipai-default-font-size", 26);
  const [uppercase, setUppercase] = useLocalStorage<boolean>("clipai-default-uppercase", true);
  const [color, setColor] = useLocalStorage<string>("clipai-default-caption-color", "#ffffff");
  const [aspect, setAspect] = useLocalStorage<string>("clipai-default-aspect", "9:16");
  const [defaultDescription, setDefaultDescription] = useLocalStorage<string>(
    "clipai-default-description",
    "New from ClipAI — turn long videos into content worth watching.",
  );

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  useEffect(() => {
    data
      .getSocialAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Settings"
        description="Defaults for new renders and publishes. These are stored on this device."
      />

      <div className="space-y-6">
        {/* Rendering defaults */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-5 flex items-center gap-2 text-base font-semibold">
            <Settings2 className="size-4 text-primary" aria-hidden />
            Rendering defaults
          </h2>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Aspect ratio</p>
                <p className="text-xs text-muted-foreground">Applied to new clip renders.</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-input p-0.5" role="group" aria-label="Default aspect ratio">
                {["9:16", "1:1", "16:9"].map((value) => (
                  <button
                    key={value}
                    onClick={() => setAspect(value)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                      aspect === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium">Caption size</span>
                <span className="tabular-nums text-muted-foreground">{fontSize}px</span>
              </div>
              <Slider min={14} max={34} step={1} value={fontSize} onValueChange={setFontSize} ariaLabel="Default caption size" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Uppercase captions</p>
                <p className="text-xs text-muted-foreground">Bold, all-caps caption style by default.</p>
              </div>
              <Switch checked={uppercase} onCheckedChange={setUppercase} label="Uppercase captions" />
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium">Caption color</span>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => setColor(swatch)}
                    aria-label={`Caption color ${swatch}`}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform",
                      color === swatch ? "scale-110 border-foreground" : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Publishing defaults */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-5 flex items-center gap-2 text-base font-semibold">
            <Plug className="size-4 text-primary" aria-hidden />
            Publishing defaults
          </h2>

          <label htmlFor="default-desc" className="mb-1.5 block text-sm font-medium">
            Default description template
          </label>
          <Textarea
            id="default-desc"
            rows={3}
            value={defaultDescription}
            onChange={(e) => setDefaultDescription(e.target.value)}
            placeholder="Description used when publishing a clip…"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown as the description/caption in the publish dialog when left empty.
          </p>

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted-foreground">Connected channels</p>
            {accounts.length === 0 ? (
              <p className="text-sm">
                No channels connected yet.{" "}
                <a href="/publishing" className="font-medium text-primary hover:underline">
                  Connect one from Publishing
                </a>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium capitalize">
                      <CheckCircle2 className="size-4 text-success" />
                      {account.platform}
                    </span>
                    <span className="text-muted-foreground">{account.display_name ?? "Connected"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Data source */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Database className="size-4 text-primary" aria-hidden />
            Data source
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">{USE_MOCK ? "Mock data (demo mode)" : "Live backend API"}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {USE_MOCK
                  ? "Using in-browser sample data so you can explore the full flow."
                  : `Connecting to ${API_BASE_URL}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast({
                  title: "Data source",
                  description: USE_MOCK
                    ? "Switch NEXT_PUBLIC_USE_MOCK=false in .env.local to hit the backend."
                    : `API base: ${API_BASE_URL}`,
                  variant: "info",
                })
              }
            >
              <RotateCcw className="size-3.5" />
              About
            </Button>
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="mb-2 text-base font-semibold text-destructive">Reset local preferences</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Restores default font size, caption style and description template on this device.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFontSize(26);
              setUppercase(true);
              setColor("#ffffff");
              setAspect("9:16");
              setDefaultDescription("New from ClipAI — turn long videos into content worth watching.");
              toast({ title: "Defaults reset", variant: "success" });
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </section>
      </div>
    </div>
  );
}