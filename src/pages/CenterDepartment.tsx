import { useState } from "react";
import { CommunityRegistry } from "@/components/CommunityRegistry";
import { ClipboardList, Users, Info } from "lucide-react";
import { centerSections } from "@/lib/center-sections";
import { departmentDetails, type CommunityDepartment } from "@/lib/center-programs";

export default function CenterDepartment({ department }: { department: CommunityDepartment }) {
  const [programFilter, setProgramFilter] = useState("all");
  const section = centerSections.find((item) => item.id === department)!;
  const details = departmentDetails[department];
  const Icon = section.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-800/20 bg-gradient-to-l from-emerald-950 to-teal-900 p-6 text-white md:p-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          <Icon className="h-4 w-4" aria-hidden="true" />
          مركز إنماء الأهلي الخيري
        </div>
        <h1 className="text-2xl font-black leading-relaxed md:text-3xl">{section.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-100 md:text-base">
          {details.introduction}
        </p>
      </section>

      <section
        aria-labelledby={`${department}-beneficiaries`}
        className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-5"
      >
        <Users className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <h2 id={`${department}-beneficiaries`} className="font-bold">
            المستفيدون من المجتمع
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{details.beneficiaries}</p>
        </div>
      </section>

      <CommunityRegistry
        department={department}
        programFilter={programFilter}
        onProgramFilter={setProgramFilter}
      />

      <section aria-labelledby={`${department}-areas`}>
        <h2 id={`${department}-areas`} className="mb-4 flex items-center gap-2 text-lg font-bold">
          <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          مجالات العمل والبرامج
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {details.areas.map((area) => {
            const AreaIcon = area.icon;
            return (
              <article key={area.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                  <AreaIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-bold">{area.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{area.description}</p>
                <ul className="mt-4 space-y-3 border-t pt-4" aria-label={`برامج ${area.title}`}>
                  {area.programs.map((program) => (
                    <li key={program.id} className="rounded-xl bg-muted/40 p-3">
                      <h4 className="text-sm font-bold">{program.name}</h4>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {program.description}
                      </p>
                      <button
                        type="button"
                        className="mt-2 rounded text-xs font-bold text-emerald-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          setProgramFilter(program.id);
                          document
                            .getElementById("community-registry")
                            ?.scrollIntoView({ block: "start", behavior: "smooth" });
                        }}
                      >
                        عرض سجلات البرنامج
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold">خصوصية البيانات والمتابعة</h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            سجلات المجتمع مستقلة عن طلاب القرآن، وتخضع لصلاحيات الحساب وأذونات الاطلاع الحالية.
            يُحفظ كل تسجيل أو خدمة بشكل مستقل؛ سجّل تاريخ كل دفعة كفالة أو توزيع جديد، ولا تجمع
            مبالغ بعملات مختلفة. يتطلب الحفظ اتصالًا بالإنترنت، ولا تُنشأ دفعات دورية تلقائيًا.
          </p>
        </div>
      </aside>
    </div>
  );
}
