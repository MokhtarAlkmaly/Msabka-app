/**
 * لوحة «المزامنة والنسخ الاحتياطي» — مركز التحكم في العمل بدون إنترنت.
 *
 * تجمع في مكان واحد:
 *  1. حالة الاتصال وحجم البيانات المحلية وآخر المزامنات.
 *  2. **الترحيل الشامل** إلى السحابة (زر واحد + معاينة + سياسة تعارض + تقرير).
 *  3. **النسخ الاحتياطي الظاهر** في مجلد على ذاكرة الهاتف (JSON + ملف قاعدة
 *     بيانات حقيقي `.db`)، مع خيار «حفظ في مكان آخر» ليصل إلى بطاقة الميموري.
 *  4. الاستعادة من أي نسخة (JSON أو `.db`) من أي مجلد.
 *  5. رمز الدخول المحلي (PIN) الذي يحمي فتح التطبيق بدون نت.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { formatTimestamp } from "@/utils/syncStatus";
import {
  canRunFullMigration,
  previewFullMigration,
  runFullMigration,
  type MigrationPreview,
} from "@/utils/fullMigration";
import {
  BACKUP_FOLDER,
  listBackupFiles,
  pickBackupFile,
  restoreFromPickedFile,
  saveDatabaseFileCopy,
  saveSnapshotToFile,
  shareSavedFile,
  type BackupFileInfo,
  type SaveResult,
} from "@/utils/dbBackup";
import {
  clearLocalPin,
  countUnlinkedDeviceRows,
  getDeviceId,
  hasLocalPin,
  linkDeviceToAccount,
  setLocalPin,
} from "@/utils/localAuth";
import { getCachedSetting, setCachedSetting } from "@/utils/localDB";
import {
  CONFLICT_STRATEGIES,
  summarizeReport,
  type ConflictStrategy,
  type MigrationReport,
} from "@/lib/migration-plan";
import { MERGE_STRATEGIES, type MergeStrategy } from "@/lib/db-snapshot";
import { isNativePlatform } from "@/utils/sqliteClient";
import {
  CloudUpload,
  DatabaseBackup,
  Download,
  FolderDown,
  HardDriveDownload,
  KeyRound,
  Link2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

const STRATEGY_SETTING_KEY = "migration_strategy";
const SAFETY_BACKUP_SETTING_KEY = "migration_safety_backup";
const MERGE_SETTING_KEY = "restore_merge_strategy";

/** تسميات عربية مختصرة لأسماء الجداول. */
const TABLE_LABELS: Record<string, string> = {
  students: "الطلاب والطالبات",
  hifz_history: "سجل الحفظ",
  year_data: "بيانات الأعوام",
  monthly_tracking: "المتابعة الشهرية",
  teachers: "المعلمون والمعلمات",
  teacher_bonuses: "الإكراميات الشهرية",
  donors: "الداعمون",
  awards: "الجوائز والسنوية والعينية",
  ceremony_expenses: "المصروفات",
  certificates: "الشهادات",
  internal_competitions: "المسابقات الداخلية",
  external_competitions: "المسابقات الخارجية",
  media: "الوسائط",
  community_records: "سجل المجتمع (المستفيدون)",
  exam_questions: "بنك الأسئلة",
};

const SyncBackupPanel = () => {
  const { toast } = useToast();
  const { user, authMode } = useAuth();
  const { status, refresh } = useSyncStatus();

  const [native, setNative] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [strategy, setStrategy] = useState<ConflictStrategy>("local-wins");
  const [safetyBackup, setSafetyBackup] = useState(true);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("merge-newest");
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [lastReport, setLastReport] = useState<MigrationReport | null>(null);
  const [lastBackup, setLastBackup] = useState<SaveResult | null>(null);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [unlinkedRows, setUnlinkedRows] = useState(0);
  const [pinSet, setPinSet] = useState(false);
  const [pin, setPin] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const loadPanel = useCallback(async () => {
    const [nextStatus, isNative, storedStrategy, storedSafety, storedMerge, storedPin] =
      await Promise.all([
        refresh(),
        isNativePlatform().catch(() => false),
        getCachedSetting<ConflictStrategy>(STRATEGY_SETTING_KEY).catch(() => undefined),
        getCachedSetting<boolean>(SAFETY_BACKUP_SETTING_KEY).catch(() => undefined),
        getCachedSetting<MergeStrategy>(MERGE_SETTING_KEY).catch(() => undefined),
        hasLocalPin().catch(() => false),
      ]);
    setNative(isNative);
    if (storedStrategy) setStrategy(storedStrategy);
    if (storedSafety !== undefined) setSafetyBackup(storedSafety);
    if (storedMerge) setMergeStrategy(storedMerge);
    setPinSet(storedPin);
    void nextStatus;

    const [nextPreview, count, files, id] = await Promise.all([
      previewFullMigration().catch(() => null),
      countUnlinkedDeviceRows().catch(() => 0),
      listBackupFiles().catch(() => [] as BackupFileInfo[]),
      getDeviceId().catch(() => null),
    ]);
    setPreview(nextPreview);
    setUnlinkedRows(count);
    setBackups(files);
    setDeviceId(id);
  }, [refresh]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  // ===== الترحيل الشامل =====
  const handleMigrate = async () => {
    setBusy("migrate");
    setLastReport(null);
    const readiness = await canRunFullMigration().catch(() => ({
      ok: false as const,
      reason: "تعذّر التحقق من جاهزية الترحيل.",
    }));
    if (!readiness.ok) {
      setBusy(null);
      toast({
        title: "لا يمكن الترحيل الآن",
        description: readiness.reason,
        variant: "destructive",
      });
      return;
    }

    setMigrating(true);
    setProgress({ current: 0, total: 1, label: "بدء الترحيل" });
    const outcome = await runFullMigration({
      strategy,
      safetyBackup,
      onProgress: (current, total, label) => setProgress({ current, total, label }),
    }).catch((error: unknown) => ({
      ok: false,
      report: null,
      summary: error instanceof Error ? error.message : String(error),
      backupFileName: null,
      error: error instanceof Error ? error.message : String(error),
    }));
    setMigrating(false);
    setProgress(null);
    setBusy(null);
    setLastReport(outcome.report);

    if (outcome.ok) {
      toast({
        title: "تم الترحيل إلى السحابة",
        description: outcome.summary.split("\n")[0],
      });
    } else {
      toast({
        title: "لم يكتمل الترحيل",
        description: outcome.error || outcome.summary.split("\n")[0],
        variant: "destructive",
      });
    }
    void loadPanel();
  };

  // ===== النسخ الاحتياطي =====
  const handleSaveJson = async () => {
    setBusy("json");
    try {
      const result = await saveSnapshotToFile();
      setLastBackup(result);
      toast({
        title: "تم حفظ النسخة",
        description: `${result.fileName} — ${result.locationLabel}`,
      });
    } catch (error) {
      toast({
        title: "تعذّر حفظ النسخة",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      void loadPanel();
    }
  };

  const handleSaveDbFile = async () => {
    setBusy("db");
    try {
      const result = await saveDatabaseFileCopy();
      setLastBackup(result);
      toast({
        title: "تم نسخ ملف القاعدة",
        description: `${result.fileName} — ${result.locationLabel}`,
      });
    } catch (error) {
      toast({
        title: "تعذّر نسخ ملف القاعدة",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      void loadPanel();
    }
  };

  const handleShare = async () => {
    if (!lastBackup) return;
    setBusy("share");
    const ok = await shareSavedFile(lastBackup, "نسخة احتياطية — نظام مركز إنماء");
    setBusy(null);
    if (!ok) {
      toast({
        title: "تعذّرت المشاركة",
        description: "الملف محفوظ في المجلد — يمكنك نقله يدوياً من مدير الملفات.",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    try {
      const picked = await pickBackupFile();
      if (!picked) {
        setBusy(null);
        return;
      }
      const report = await restoreFromPickedFile(picked, mergeStrategy);
      toast({
        title: "تمت الاستعادة",
        description:
          picked.kind === "db"
            ? `${picked.name} — استُعيدت جداول قاعدة البيانات (${report.tables.length} جدول).`
            : `${picked.name} — أُضيف ${report.totals.inserted}، وحُدّث ${report.totals.updated}، وبقي ${report.totals.keptLocal} من بيانات الجهاز.`,
      });
      setBusy(null);
      // إعادة تحميل التطبيق ضرورية حتى تقرأ كل الشاشات البيانات المستعادة.
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setBusy(null);
      toast({
        title: "تعذّرت الاستعادة",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  // ===== ربط بيانات الجهاز بالحساب =====
  const handleLinkDevice = async () => {
    if (!user?.id) {
      toast({
        title: "يلزم تسجيل الدخول أولاً",
        description: "سجّل الدخول بحسابك وسيقوم التطبيق بربط بيانات الجهاز تلقائياً.",
        variant: "destructive",
      });
      return;
    }
    setBusy("link");
    try {
      const { total } = await linkDeviceToAccount(user.id);
      toast({
        title: total > 0 ? "تم ربط بيانات الجهاز" : "لا توجد بيانات لربطها",
        description:
          total > 0
            ? `${total} سجل صار منسوباً إلى حسابك وجاهزاً للترحيل.`
            : "كل البيانات المحلية منسوبة لحسابك أصلاً.",
      });
    } catch (error) {
      toast({
        title: "تعذّر الربط",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      void loadPanel();
    }
  };

  // ===== رمز الدخول المحلي =====
  const handleSavePin = async () => {
    setBusy("pin");
    const error = await setLocalPin(pin);
    if (error) {
      toast({ title: "رمز غير صالح", description: error, variant: "destructive" });
      setBusy(null);
      return;
    }
    setPin("");
    setPinSet(true);
    toast({
      title: "تم ضبط رمز الدخول المحلي",
      description: "سيُطلب هذا الرمز لفتح التطبيق بدون إنترنت.",
    });
    setBusy(null);
  };

  const handleClearPin = async () => {
    setBusy("pin");
    await clearLocalPin();
    setPinSet(false);
    setPin("");
    toast({ title: "تم إلغاء رمز الدخول المحلي" });
    setBusy(null);
  };

  const online = status?.online ?? true;
  const progressPercent =
    progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* ============ الحالة ============ */}
      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {online ? (
              <Wifi className="h-5 w-5 text-primary" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-600" />
            )}
            حالة الاتصال والبيانات المحلية
          </CardTitle>
          <CardDescription>
            البيانات تُحفظ دائماً على الجهاز أولاً، وتُرحَّل إلى السحابة عند الطلب أو عند توفر
            الاتصال.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={online ? "default" : "secondary"} className="gap-1">
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "متصل بالإنترنت" : "بدون إنترنت"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <DatabaseBackup className="h-3.5 w-3.5" />
              {status?.totalRows ?? 0} سجل على الجهاز
            </Badge>
            {(status?.pendingCount ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700">
                <RefreshCw className="h-3.5 w-3.5" />
                {status?.pendingCount} تغيير بانتظار الترحيل
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {authMode === "cloud"
                ? "جلسة سحابية"
                : authMode === "offline"
                  ? "جلسة محلية بحساب محفوظ"
                  : authMode === "device"
                    ? "وضع الجهاز (بلا حساب)"
                    : "بلا جلسة"}
            </Badge>
          </div>

          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <div>آخر مزامنة</div>
              <div className="mt-1 font-bold text-foreground">
                {formatTimestamp(status?.lastSyncAt ?? null)}
              </div>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <div>آخر ترحيل شامل</div>
              <div className="mt-1 font-bold text-foreground">
                {formatTimestamp(status?.lastMigrationAt ?? null)}
              </div>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <div>آخر نسخة احتياطية</div>
              <div className="mt-1 font-bold text-foreground">
                {formatTimestamp(status?.lastBackupAt ?? null)}
              </div>
            </div>
          </div>

          {status && status.totalRows > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(status.counts)
                .filter(([, count]) => count > 0)
                .map(([table, count]) => (
                  <span
                    key={table}
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                  >
                    {TABLE_LABELS[table] ?? table}: {count}
                  </span>
                ))}
            </div>
          )}

          {deviceId && (
            <p className="text-[11px] text-muted-foreground">
              معرّف الجهاز: <span dir="ltr">{deviceId}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ============ ربط وضع الجهاز ============ */}
      {(authMode === "device" || unlinkedRows > 0) && (
        <Card className="rounded-[1.75rem] border-amber-300/60 bg-amber-50/60 shadow-xl shadow-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
              <Link2 className="h-5 w-5" />
              بيانات الجهاز بلا حساب
            </CardTitle>
            <CardDescription className="text-amber-800">
              {unlinkedRows > 0
                ? `يوجد ${unlinkedRows} سجل محفوظ محلياً بلا حساب.`
                : "التطبيق يعمل في «وضع الجهاز»."}{" "}
              اربطها بحسابك لتتمكن من ترحيلها إلى السحابة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => void handleLinkDevice()}
              disabled={busy !== null}
              className="gap-2 rounded-2xl bg-amber-600 text-white hover:bg-amber-700"
            >
              <Link2 className="h-4 w-4" />
              {busy === "link" ? "جارٍ الربط..." : "اربط بيانات هذا الجهاز بحسابي"}
            </Button>
            {!user?.id && (
              <p className="mt-2 text-xs text-amber-800">
                تحتاج إلى تسجيل الدخول بحسابك أولاً — سيُنفَّذ الربط تلقائياً بعدها.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============ الترحيل الشامل ============ */}
      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CloudUpload className="h-5 w-5 text-primary" />
            الترحيل الشامل إلى السحابة
          </CardTitle>
          <CardDescription>
            يرفع <strong>كل</strong> ما على الجهاز دفعة واحدة إلى حسابك في Supabase — مناسب بعد فترة
            عمل طويلة بدون إنترنت.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview && (
            <div className="rounded-2xl bg-muted/50 p-3 text-xs">
              <div className="font-bold text-foreground">
                سيُرفع {preview.total} سجل في {preview.tables.length} جدول
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.tables.map((entry) => (
                  <span
                    key={entry.table}
                    className="rounded-full bg-background px-2.5 py-1 font-semibold text-primary ring-1 ring-primary/15"
                  >
                    {entry.label}: {entry.count}
                  </span>
                ))}
              </div>
              {preview.tempStudents > 0 && (
                <div className="mt-2 text-amber-700">
                  {preview.tempStudents} طالب/ة أُنشئوا بدون نت — ستُطابَق معرفاتهم تلقائياً مع
                  السحابة.
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-bold text-foreground">عند وجود السجل نفسه في السحابة:</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {CONFLICT_STRATEGIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setStrategy(option.id);
                    void setCachedSetting(STRATEGY_SETTING_KEY, option.id);
                  }}
                  className={`rounded-2xl border p-3 text-right text-xs transition-colors ${
                    strategy === option.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="block font-bold">{option.label}</span>
                  <span className="mt-1 block leading-5">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 p-3">
            <div className="text-xs">
              <div className="font-bold text-foreground">نسخة أمان قبل الترحيل</div>
              <div className="text-muted-foreground">
                تُحفظ نسخة JSON في مجلد {BACKUP_FOLDER} قبل أي كتابة سحابية.
              </div>
            </div>
            <Switch
              checked={safetyBackup}
              onCheckedChange={(checked) => {
                setSafetyBackup(checked);
                void setCachedSetting(SAFETY_BACKUP_SETTING_KEY, checked);
              }}
            />
          </div>

          {progress && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2 rounded-full" />
              <div className="text-xs text-muted-foreground">
                {progress.label || "جارٍ الترحيل"}: {progress.current} / {progress.total}
              </div>
            </div>
          )}

          <Button
            onClick={() => void handleMigrate()}
            disabled={migrating || busy !== null || !online}
            className="h-12 w-full gap-2 rounded-2xl shadow-lg shadow-primary/20"
          >
            <CloudUpload className="h-4 w-4" />
            {migrating ? "جارٍ الترحيل..." : "رحّل كل البيانات إلى السحابة الآن"}
          </Button>
          {!online && (
            <p className="text-center text-xs text-muted-foreground">
              الزر يتفعّل تلقائياً عند توفر الاتصال — بياناتك محفوظة على الجهاز ولن تضيع.
            </p>
          )}

          {lastReport && (
            <div
              className={`whitespace-pre-line rounded-2xl p-3 text-xs leading-6 ${
                lastReport.ok
                  ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                  : "bg-destructive/10 text-destructive ring-1 ring-destructive/25"
              }`}
            >
              {summarizeReport(lastReport)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ النسخ الاحتياطي في مجلد ============ */}
      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderDown className="h-5 w-5 text-primary" />
            النسخ الاحتياطي في مجلد الجهاز
          </CardTitle>
          <CardDescription>
            القاعدة الحيّة في ذاكرة التطبيق، ونسخها تُحفظ في مجلد <strong>{BACKUP_FOLDER}</strong>{" "}
            الظاهر في «المستندات»، ويمكن نقلها إلى بطاقة الميموري عبر «حفظ في مكان آخر».
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void handleSaveJson()}
              disabled={busy !== null}
              className="h-11 flex-1 gap-2 rounded-2xl"
            >
              <Download className="h-4 w-4" />
              {busy === "json" ? "جارٍ الحفظ..." : "حفظ نسخة (JSON) في المجلد"}
            </Button>
            <Button
              onClick={() => void handleSaveDbFile()}
              disabled={busy !== null || !native}
              variant="outline"
              className="h-11 flex-1 gap-2 rounded-2xl"
              title={native ? undefined : "متاح في تطبيق أندرويد فقط"}
            >
              <HardDriveDownload className="h-4 w-4" />
              {busy === "db" ? "جارٍ النسخ..." : "نسخ ملف القاعدة (.db)"}
            </Button>
          </div>

          {lastBackup && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3 text-xs">
              <div>
                <div className="font-bold text-foreground">{lastBackup.fileName}</div>
                <div className="text-muted-foreground">
                  {lastBackup.locationLabel} — {(lastBackup.bytes / 1024).toFixed(1)} ك.ب
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 rounded-xl"
                disabled={busy !== null || !native}
                onClick={() => void handleShare()}
              >
                <Share2 className="h-3.5 w-3.5" />
                {busy === "share" ? "جارٍ..." : "حفظ في مكان آخر (ميموري/Drive)"}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-bold text-foreground">عند الاستعادة من ملف:</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {MERGE_STRATEGIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setMergeStrategy(option.id);
                    void setCachedSetting(MERGE_SETTING_KEY, option.id);
                  }}
                  className={`rounded-2xl border p-3 text-right text-xs transition-colors ${
                    mergeStrategy === option.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="block font-bold">{option.label}</span>
                  <span className="mt-1 block leading-5">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => void handleRestore()}
            disabled={busy !== null}
            variant="outline"
            className="h-11 w-full gap-2 rounded-2xl"
          >
            <RefreshCw className="h-4 w-4" />
            {busy === "restore" ? "جارٍ الاستعادة..." : "استعادة من ملف نسخة (JSON أو .db)"}
          </Button>

          {backups.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-foreground">النسخ المحفوظة في المجلد</div>
              {backups.slice(0, 6).map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px]"
                >
                  <span className="truncate font-semibold" dir="ltr">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} ك.ب — {formatTimestamp(file.modifiedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ رمز الدخول المحلي ============ */}
      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            رمز الدخول بدون إنترنت
          </CardTitle>
          <CardDescription>
            رمز محلي (4-8 أرقام) يُطلب لفتح التطبيق عندما لا يتوفر إنترنت. يُحفظ كبصمة مشفّرة على
            الجهاز فقط — ولا يُرسل إلى السحابة أبداً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              inputMode="numeric"
              dir="ltr"
              placeholder={pinSet ? "رمز جديد (4-8 أرقام)" : "اضبط رمزاً (4-8 أرقام)"}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              className="h-11 flex-1 rounded-2xl"
            />
            <Button
              onClick={() => void handleSavePin()}
              disabled={busy !== null || pin.length < 4}
              className="h-11 gap-2 rounded-2xl"
            >
              <ShieldCheck className="h-4 w-4" />
              {pinSet ? "تغيير الرمز" : "ضبط الرمز"}
            </Button>
            {pinSet && (
              <Button
                onClick={() => void handleClearPin()}
                disabled={busy !== null}
                variant="outline"
                className="h-11 rounded-2xl"
              >
                إلغاء الرمز
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            الحالة الحالية:{" "}
            {pinSet
              ? "الرمز مفعّل — سيُطلب للدخول بدون نت."
              : "لا يوجد رمز — الدخول بدون نت يفتح مباشرة بالهوية المحفوظة."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncBackupPanel;
