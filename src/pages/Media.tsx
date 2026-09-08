import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Upload, Trash2, Image, Video, X } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { START_YEAR, END_YEAR } from "@/types/student";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { loadMediaMetadata, saveMediaMetadata, deleteMediaMetadataLocal } from "@/utils/storage";
import { putMediaFile, getMediaFile, deleteMediaFile } from "@/utils/localDB";

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

interface MediaItem {
  id: string;
  year: string;
  month: number;
  title: string;
  file_path: string;
  file_type: "image" | "video";
  file_size: number;
  created_at: string;
}

const Media = () => {
  const [selectedYear, setSelectedYear] = useState("1447");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();
  // Object URLs created for local blobs must be revoked when replaced/unmounted.
  const urlsRef = useRef<Record<string, string>>({});

  const revokeAllUrls = () => {
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
  };

  const loadMedia = useCallback(async () => {
    setLoading(true);
    const items = (await loadMediaMetadata(selectedYear)) as MediaItem[];
    setMediaItems(items);

    // Build local object URLs from the on-device blobs for each item.
    revokeAllUrls();
    const map: Record<string, string> = {};
    for (const item of items) {
      const blob = await getMediaFile(item.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        map[item.id] = url;
      }
    }
    urlsRef.current = map;
    setFileUrls(map);
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    loadMedia();
    return () => revokeAllUrls();
  }, [loadMedia]);

  const getUrl = (id: string) => fileUrls[id] || "";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);

    const files = Array.from(e.target.files);

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast({ title: "نوع ملف غير مدعوم", description: file.name, variant: "destructive" });
        continue;
      }

      // Get current Hijri month
      const hijriDate = new Date().toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { month: "numeric" });
      const currentMonth = parseInt(hijriDate) || 1;

      const ext = file.name.split(".").pop();
      const filePath = `${selectedYear}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const saved = await saveMediaMetadata({
        year: selectedYear,
        month: currentMonth,
        title: file.name,
        file_path: filePath,
        file_type: isImage ? "image" : "video",
        file_size: file.size,
      });

      if (!saved) {
        toast({ title: "خطأ في الحفظ", description: file.name, variant: "destructive" });
        continue;
      }

      // Store the actual file bytes locally on this device.
      await putMediaFile(saved.id, file);
    }

    setUploading(false);
    await loadMedia();
    toast({ title: "تم الحفظ", description: `تم حفظ ${files.length} ملف محلياً على هذا الجهاز` });
    e.target.value = "";
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;

    await deleteMediaFile(item.id);
    await deleteMediaMetadataLocal(item.id);
    await loadMedia();
    toast({ title: "تم الحذف", variant: "destructive" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group by month
  const groupedByMonth: Record<number, MediaItem[]> = {};
  mediaItems.forEach((item) => {
    if (!groupedByMonth[item.month]) groupedByMonth[item.month] = [];
    groupedByMonth[item.month].push(item);
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]" dir="rtl">
      <header className="mx-3 mt-3 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 px-4 py-5 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="container mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-bold">📸 الصور والفيديوهات</h1>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-primary-foreground gap-1">
              <ArrowRight className="h-4 w-4" />
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-white/70 bg-card/90 p-4 shadow-xl shadow-primary/5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">السنة:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}هـ
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="cursor-pointer">
            <Button asChild disabled={uploading} className="gap-2">
              <span>
                <Upload className="h-4 w-4" />
                {uploading ? "جارٍ الحفظ..." : "رفع صور / فيديوهات"}
              </span>
            </Button>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          <span className="mr-auto text-sm text-muted-foreground">
            الملفات: <span className="font-bold text-foreground">{mediaItems.length}</span>
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : mediaItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Image className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد صور أو فيديوهات لعام {selectedYear}هـ</p>
            <p className="text-sm mt-1">اضغط على "رفع صور / فيديوهات" لإضافة ملفات</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByMonth)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([month, items]) => (
                <div key={month}>
                  <h2 className="text-lg font-bold mb-3 text-primary border-b border-border pb-2">
                    📅 {HIJRI_MONTHS[parseInt(month) - 1]} - {selectedYear}هـ
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-lg shadow-primary/5 transition-shadow hover:shadow-xl"
                      >
                        <div
                          className="aspect-square cursor-pointer"
                          onClick={() => setPreviewItem(item)}
                        >
                          {item.file_type === "image" ? (
                            <img
                              src={getUrl(item.id)}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Video className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs truncate text-muted-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground/60">{formatSize(item.file_size)}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(item)}
                          className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <button
            onClick={() => setPreviewItem(null)}
            className="absolute top-2 left-2 z-10 bg-background/80 rounded-full p-1"
          >
            <X className="h-5 w-5" />
          </button>
          {previewItem && (
            previewItem.file_type === "image" ? (
              <img
                src={getUrl(previewItem.id)}
                alt={previewItem.title}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            ) : (
              <video
                src={getUrl(previewItem.id)}
                controls
                className="w-full max-h-[85vh]"
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Media;
