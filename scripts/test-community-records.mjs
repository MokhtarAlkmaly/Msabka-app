import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const calls = [];
const responses = [];
let userId = "owner-a";
let viewAs = null;
globalThis.__communityTestClient = {
  auth: {
    getSession: async () => ({
      data: { session: userId ? { user: { id: userId } } : null },
      error: null,
    }),
  },
  from(table) {
    const call = { table, filters: [], orders: [] };
    calls.push(call);
    const builder = {
      select(value) {
        call.select = value;
        return this;
      },
      eq(key, value) {
        call.filters.push([key, value]);
        return this;
      },
      order(key, options) {
        call.orders.push([key, options]);
        return this;
      },
      range(from, to) {
        call.range = [from, to];
        return this;
      },
      abortSignal(signal) {
        call.signal = signal;
        return this;
      },
      insert(values) {
        call.insert = values;
        return this;
      },
      update(values) {
        call.update = values;
        return this;
      },
      delete() {
        call.delete = true;
        return this;
      },
      single() {
        call.single = true;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(responses.shift() ?? { data: [], error: null }).then(
          resolve,
          reject,
        );
      },
    };
    return builder;
  },
};
globalThis.__communityTestViewAs = () => viewAs;
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  plugins: [
    {
      name: "community-storage-test-doubles",
      load(id) {
        if (id.endsWith("/integrations/supabase/client.ts"))
          return "export const supabase = globalThis.__communityTestClient;";
        if (id.endsWith("/utils/viewAs.ts"))
          return "export const getViewAsId = globalThis.__communityTestViewAs; export const isViewingOtherUser = () => getViewAsId() !== null;";
      },
    },
  ],
});
try {
  const model = await vite.ssrLoadModule("/src/lib/community-records.ts");
  const storage = await vite.ssrLoadModule("/src/utils/communityStorage.ts");
  const base = {
    department: "training",
    program_id: "sewing",
    beneficiary_name: "مستفيد المجتمع",
    beneficiary_type: "individual",
    phone: null,
    guardian_name: null,
    address: null,
    service_date: "2026-10-15",
    status: "registered",
    group_name: null,
    sponsor_name: null,
    amount: null,
    currency: null,
    quantity: null,
    notes: null,
  };
  for (const department of ["training", "care"]) {
    for (const program of model.getDepartmentPrograms(department)) {
      const orphan = model.isOrphanProgram(program.id);
      const child = model.isChildProgram(program.id);
      const money = model.isMoneyProgram(program.id);
      assert.ok(
        model.communityRecordSchema.safeParse({
          ...base,
          department,
          program_id: program.id,
          beneficiary_type: orphan ? "orphan" : child ? "child" : "individual",
          guardian_name: orphan || child ? "الوصي" : null,
          amount: money ? 200 : null,
          currency: money ? "YER" : null,
          quantity: program.id === "food-baskets" ? 1 : null,
        }).success,
        `Valid program: ${program.id}`,
      );
    }
  }
  for (const changes of [
    { beneficiary_name: " " },
    { program_id: "unknown" },
    { department: "care" },
    { service_date: "2026-02-30" },
    { status: "invalid" },
    { quantity: 1 },
    { amount: 1, currency: "YER" },
    { beneficiary_type: "child" },
    { beneficiary_type: "orphan" },
    { department: "care", program_id: "cash-assistance", amount: -1, currency: "YER" },
    { department: "care", program_id: "cash-assistance", amount: 100 },
    { department: "care", program_id: "food-baskets", quantity: 1.5 },
    { department: "care", program_id: "food-baskets", quantity: 0 },
    { notes: "x".repeat(3001) },
  ])
    assert.equal(
      model.communityRecordSchema.safeParse({ ...base, ...changes }).success,
      false,
      JSON.stringify(changes),
    );
  const row = {
    ...base,
    id: "record-a",
    user_id: "owner-a",
    phone: "777123456",
    group_name: "دفعة أولى",
    sponsor_name: "كافل تجريبي",
  };
  for (const term of ["المجتمع", "777", "دفعة", "كافل"])
    assert.equal(model.filterCommunityRecords([row], term, "all", "all").length, 1);
  assert.equal(model.filterCommunityRecords([row], "", "sewing", "registered").length, 1);
  assert.equal(model.filterCommunityRecords([row], "", "design", "registered").length, 0);
  assert.equal(model.filterCommunityRecords([row], "", "all", "completed").length, 0);
  assert.equal(model.filterCommunityRecords([row], "غير موجود", "all", "all").length, 0);

  const summary = model.summarizeCompletedServices([
    { ...row, status: "completed", amount: 0.1, currency: "YER" },
    { ...row, status: "completed", amount: 0.2, currency: "YER" },
    { ...row, status: "completed", amount: 20, currency: "SAR" },
    { ...row, status: "cancelled", amount: 1000, currency: "USD" },
    { ...row, status: "in_progress", amount: 1000, currency: "YER" },
    { ...row, status: "completed", program_id: "food-baskets", quantity: 3 },
    { ...row, status: "registered", program_id: "food-baskets", quantity: 5 },
  ]);
  assert.deepEqual(summary, { baskets: 3, amounts: { YER: 0.3, SAR: 20, USD: 0 } });
  assert.equal(
    model.communityRecordSchema.safeParse({
      ...base,
      department: "care",
      program_id: "cash-assistance",
      amount: 1.001,
      currency: "YER",
    }).success,
    false,
  );

  responses.push(
    { data: Array.from({ length: 500 }, () => row), error: null },
    { data: [row], error: null },
  );
  const controller = new AbortController();
  assert.equal((await storage.loadCommunityRecords("training", controller.signal)).length, 501);
  assert.deepEqual(calls[0].range, [0, 499]);
  assert.deepEqual(calls[1].range, [500, 999]);
  assert.equal(calls[0].signal, controller.signal);
  assert.deepEqual(calls[0].filters, [
    ["user_id", "owner-a"],
    ["department", "training"],
  ]);

  responses.push({ data: row, error: null });
  await storage.saveCommunityRecord(base, undefined, "owner-a");
  assert.equal(calls.at(-1).insert.user_id, "owner-a");
  assert.equal(calls.at(-1).table, "community_records");
  responses.push({ data: row, error: null });
  await storage.saveCommunityRecord(base, "record-a", "owner-a");
  assert.deepEqual(calls.at(-1).filters, [
    ["id", "record-a"],
    ["user_id", "owner-a"],
    ["department", "training"],
  ]);
  assert.ok(calls.at(-1).update && calls.at(-1).single);
  responses.push({ data: { id: "record-a" }, error: null });
  await storage.deleteCommunityRecord("record-a", "training", "owner-a");
  assert.ok(calls.at(-1).delete && calls.at(-1).single);

  for (const operation of [
    () => storage.saveCommunityRecord(base, "record-a", "owner-a"),
    () => storage.deleteCommunityRecord("record-a", "training", "owner-a"),
  ]) {
    responses.push({ data: null, error: { code: "PGRST116" } });
    await assert.rejects(operation, (error) => error.code === "PGRST116");
  }

  const before = calls.length;
  viewAs = "owner-b";
  await assert.rejects(() => storage.saveCommunityRecord(base, undefined, "owner-a"), /قراءة فقط/);
  await assert.rejects(
    () => storage.deleteCommunityRecord("record-a", "training", "owner-a"),
    /قراءة فقط/,
  );
  assert.equal(calls.length, before);
  responses.push({ data: [], error: null });
  await storage.loadCommunityRecords("care");
  assert.deepEqual(calls.at(-1).filters, [
    ["user_id", "owner-b"],
    ["department", "care"],
  ]);
  viewAs = null;
  userId = "owner-b";
  await assert.rejects(
    () => storage.saveCommunityRecord(base, undefined, "owner-a"),
    /تغيّر الحساب/,
  );
  userId = null;
  await assert.rejects(() => storage.loadCommunityRecords("care"), /تسجيل الدخول/);
  userId = "owner-a";
  responses.push({ data: null, error: { code: "42P01" } });
  await assert.rejects(
    () => storage.loadCommunityRecords("care"),
    (error) => error.code === "42P01",
  );
  assert.match(storage.communityErrorMessage({ code: "42P01" }), /20261015100000/);
  assert.match(storage.communityErrorMessage({ code: "42501" }), /صلاحية/);
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  try {
    await assert.rejects(() => storage.loadCommunityRecords("care"), /بالإنترنت/);
    await assert.rejects(
      () => storage.saveCommunityRecord(base, undefined, "owner-a"),
      /بالإنترنت/,
    );
    await assert.rejects(
      () => storage.deleteCommunityRecord("record-a", "training", "owner-a"),
      /بالإنترنت/,
    );
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
  assert.equal(responses.length, 0);
  console.log(
    "Community records: all program validation, search, pagination, CRUD and account/read-only/offline checks passed.",
  );
} finally {
  await vite.close();
  delete globalThis.__communityTestClient;
  delete globalThis.__communityTestViewAs;
}
