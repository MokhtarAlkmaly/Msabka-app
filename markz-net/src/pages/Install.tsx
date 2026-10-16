import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, CheckCircle2, Smartphone, Monitor } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Smartphone className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl mb-2">ثبّت «Markz Net — نسخة بلا إنترنت»</CardTitle>
              <CardDescription className="text-lg">
                نسخة محلية كاملة: تعمل بدون إنترنت، وكل بياناتك تبقى على جهازك
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {isInstalled ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <CheckCircle2 className="h-16 w-16 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold text-success">تم التثبيت بنجاح!</h3>
                  <p className="text-muted-foreground">
                    يمكنك الآن استخدام التطبيق من الشاشة الرئيسية لجوالك
                  </p>
                  <Button onClick={() => navigate("/")} size="lg" className="w-full">
                    العودة للتطبيق
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">مميزات التطبيق:</h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                        <span>يعمل بدون إنترنت بعد التثبيت — بلا خادم ولا سحابة</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                        <span>سرعة فتح فائقة من الشاشة الرئيسية</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                        <span>لا يحتاج مساحة كبيرة على الجوال</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                        <span>تحديثات تلقائية دون الحاجة لإعادة التثبيت</span>
                      </li>
                    </ul>
                  </div>

                  {deferredPrompt ? (
                    <Button onClick={handleInstallClick} size="lg" className="w-full gap-2">
                      <Download className="h-5 w-5" />
                      ثبت التطبيق الآن
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Monitor className="h-5 w-5" />
                          طريقة التثبيت اليدوي:
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="font-semibold mb-1">على أندرويد (Chrome):</p>
                            <ol className="list-decimal list-inside space-y-1 mr-4">
                              <li>اضغط على القائمة (⋮) في أعلى المتصفح</li>
                              <li>اختر "إضافة إلى الشاشة الرئيسية"</li>
                              <li>اضغط "إضافة"</li>
                            </ol>
                          </div>
                          <div>
                            <p className="font-semibold mb-1">على iPhone (Safari):</p>
                            <ol className="list-decimal list-inside space-y-1 mr-4">
                              <li>اضغط على زر المشاركة (▭)</li>
                              <li>اختر "إضافة إلى الشاشة الرئيسية"</li>
                              <li>اضغط "إضافة"</li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => navigate("/")}
                        variant="outline"
                        size="lg"
                        className="w-full"
                      >
                        تخطي والمتابعة للتطبيق
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Install;
