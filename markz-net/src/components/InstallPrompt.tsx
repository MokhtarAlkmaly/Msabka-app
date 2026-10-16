import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem("installPromptDismissed");
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;

    if (dismissed || isInstalled) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If the browser doesn't support the install prompt, go to install page
      navigate("/install");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("installPromptDismissed", "true");
  };

  const handleLearnMore = () => {
    navigate("/install");
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 print:hidden">
      <Card className="shadow-lg border-2 border-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">
                ثبّت «Markz Net — نسخة بلا إنترنت» على جوالك
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                للوصول السريع، ويعمل بلا إنترنت وبياناته تبقى على جهازك
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstallClick} className="text-xs h-8">
                  تثبيت
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLearnMore}
                  className="text-xs h-8"
                >
                  معرفة المزيد
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
