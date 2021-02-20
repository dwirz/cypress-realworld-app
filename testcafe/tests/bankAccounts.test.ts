import {
  FakeTimers,
  mockResponse,
  RequestCallCountMock,
  XHRInterceptor,
} from "@smartive/testcafe-utils";
import { createTestPlans, StatesTestFunctions } from "@smartive/xstate-test-toolbox";
import { TestEventsConfig } from "@xstate/test/lib/types";
import { RequestMock, Selector } from "testcafe";
import { bankAccountsMachine } from "../../src/machines/bankAccountsMachine";
import { DataContext } from "../../src/machines/dataMachine";
import { fixtures } from "../fixtures";
import { bankCustomer } from "../roles/bankCustomer";

type TestContext = {
  t: TestController;
  plan: string;
  path: string;
  meta: { bankName: string; routingNumber: string; accountNumber: string };
};

const xhrInterceptor = new XHRInterceptor({
  getBankAccounts: { method: "GET", pattern: /.*http:\/\/localhost:3001\/bankAccounts\/?.*/ },
  deleteBankAccounts: { method: "DELETE", pattern: /.*http:\/\/localhost:3001\/bankAccounts\/?.*/ },
  postBankAccounts: { method: "POST", pattern: /.*http:\/\/localhost:3001\/bankAccounts\/?.*/ },
});

const mockClock = new FakeTimers({ toFake: ["setTimeout"] });

const getRequestMocks = (plan: string, path: string): object[] => {
  const { getBankAccounts, postBankAccounts, deleteBankAccounts } = xhrInterceptor.interceptUrls;
  const headers = { "access-control-allow-origin": "http://localhost:3000" };
  const errorRequestMock = (pattern: RegExp, method: string) =>
    RequestMock()
      .onRequestTo((req) => pattern.test(req.url) && req.method === method)
      .respond(mockResponse({}, 400, method.toUpperCase(), headers));
  const createDataErrorMock = errorRequestMock(postBankAccounts.pattern, "post");
  const deleteDataErrorMock = errorRequestMock(deleteBankAccounts.pattern, "delete");
  const deleteDataValidMock = RequestMock()
    .onRequestTo(({ url, method }) => deleteBankAccounts.pattern.test(url) && method === "delete")
    .respond(mockResponse({}, 200, "DELETE", headers));

  if (
    (plan.includes('"success":"withoutData"') &&
      [
        "idle → DELETE → deleting → done.invoke.deleteData → loading → done.invoke.fetchData",
        "idle → DELETE → deleting → error.platform.deleteData → failure → FETCH → loading → done.invoke.fetchData",
      ].includes(path)) ||
    [
      'idle → DELETE → deleting → done.invoke.deleteData → loading → done.invoke.fetchData → "success":"withoutData" → CREATE',
      'idle → DELETE → deleting → done.invoke.deleteData → loading → done.invoke.fetchData → "success":"withoutData" → CREATE → creating → error.platform.createData',
      'idle → DELETE → deleting → error.platform.deleteData → failure → FETCH → loading → done.invoke.fetchData → "success":"withoutData" → CREATE',
    ].includes(path)
  ) {
    return [
      path.includes("error.platform.deleteData") ? deleteDataErrorMock : deleteDataValidMock,
      path.includes("error.platform.createData") && createDataErrorMock,
      new RequestCallCountMock(getBankAccounts.pattern, [
        { body: mockResponse(fixtures.getBankAccounts, 200, "GET", headers) },
        { body: mockResponse({ results: [] }, 200, "GET", headers) },
      ]),
    ].filter(Boolean);
  }

  if (
    path ===
    "idle → DELETE → deleting → done.invoke.deleteData → loading → error.platform.fetchData"
  ) {
    return [
      deleteDataValidMock,
      new RequestCallCountMock(getBankAccounts.pattern, [
        { body: mockResponse(fixtures.getBankAccounts, 200, "GET", headers) },
        { body: mockResponse({}, 400, "GET", headers) },
      ]),
    ];
  }

  return [
    path.includes("error.platform.createData") && createDataErrorMock,
    path.includes("error.platform.deleteData") && deleteDataErrorMock,
    path.includes("error.platform.fetchData") && errorRequestMock(getBankAccounts.pattern, "get"),
    (plan.includes('"success":"withoutData"') ||
      path.startsWith(
        'idle → FETCH → loading → done.invoke.fetchData → "success":"withoutData" → CREATE'
      )) &&
      RequestMock()
        .onRequestTo(({ url, method }) => getBankAccounts.pattern.test(url) && method === "get")
        .respond(mockResponse({ results: [] }, 200, "GET", headers)),
  ].filter(Boolean);
};

const tests: StatesTestFunctions<DataContext, TestContext> = {
  idle: ({ t }) => t.expect(Selector('[data-test="bank-accounts-idle"]').exists).ok(),
  loading: ({ t }) => t.expect(Selector('[data-test="bank-accounts-loading"]').exists).ok(),
  creating: ({ t }) => t.expect(Selector('[data-test="bank-accounts-creating"]').exists).ok(),
  deleting: ({ t }) => t.expect(Selector('[data-test="bank-accounts-deleting"]').exists).ok(),
  failure: ({ t }) =>
    t
      .expect(Selector('[data-test="bank-accounts-failure"]').exists)
      .ok()
      .expect(Selector('[data-test="bank-accounts-refetch"]').exists)
      .ok(),
  success: {
    withData: ({ t }) =>
      t.expect(Selector('[data-test="bank-accounts-success-withData"]').exists).ok(),
    withoutData: ({ t }) =>
      t.expect(Selector('[data-test="bank-accounts-success-withoutData"]').exists).ok(),
  },
};

const testEvents: TestEventsConfig<TestContext> = {
  FETCH: async ({ t }) => {
    const refetchButton = Selector('[data-test="bank-accounts-refetch"]');
    if (await refetchButton.exists) {
      return t.click(refetchButton);
    }

    return t.expect(mockClock.execute({ t, method: "next", methodArgs: [] })).ok();
  },
  CREATE: async ({ t, meta: { bankName, accountNumber, routingNumber } }) => {
    const nextButton = Selector('[data-test="user-onboarding-next"]');
    const isOnboarding = await nextButton.exists;

    if (isOnboarding) {
      await t.click(nextButton);
    } else {
      await t.click('[data-test="bankaccount-new"]');
    }

    await t
      .typeText('[data-test="bankaccount-bankName-input"]', bankName)
      .typeText('[data-test="bankaccount-routingNumber-input"]', routingNumber)
      .typeText('[data-test="bankaccount-accountNumber-input"]', accountNumber)
      .click('[data-test="bankaccount-submit"]');

    if (isOnboarding) {
      await t.click(nextButton);
    }
  },
  DELETE: async ({ t }) => {
    const listItem = Selector('[data-test^="bankaccount-list-item-"]');
    if (!(await listItem.exists)) {
      await t
        .expect(mockClock.execute({ t, method: "next", methodArgs: [] }))
        .ok()
        .expect(xhrInterceptor.resolve("getBankAccounts")({ t }))
        .ok();
    }

    return t.click(listItem.nth(1).find('[data-test="bankaccount-delete"]'));
  },
  "done.invoke.createData": xhrInterceptor.resolve("postBankAccounts"),
  "error.platform.createData": xhrInterceptor.resolve("postBankAccounts"),
  "done.invoke.fetchData": xhrInterceptor.resolve("getBankAccounts"),
  "error.platform.fetchData": xhrInterceptor.resolve("getBankAccounts"),
  "done.invoke.deleteData": xhrInterceptor.resolve("deleteBankAccounts"),
  "error.platform.deleteData": xhrInterceptor.resolve("deleteBankAccounts"),
};

createTestPlans({
  machine: bankAccountsMachine,
  tests,
  testEvents,
  // Since bankAccounts do not have an `updating`/`UPDATE` functionality within the UI but
  // is a state in `dataMachine` and therefore is a path, skip it
  skip: { plans: [/"updating"/], paths: [/→ UPDATE/] },
}).forEach(({ description: plan, paths }) => {
  fixture(plan).page(`http://localhost:3000`);

  paths.forEach(({ test: run, description: path }) =>
    test
      .clientScripts([xhrInterceptor.clientScript(), mockClock.clientScript()])
      .requestHooks(getRequestMocks(plan, path))(`via ${path} ⬏`, async (t) => {
      const now = `${Date.now()}`;
      const meta = {
        bankName: `Foo Bank ${now}`,
        routingNumber: now.slice(0, 9),
        accountNumber: now.split("").reverse().join("").slice(0, 9),
      };

      await t.useRole(bankCustomer).click('[data-test="sidenav-bankaccounts"]');

      return run({ plan, path, meta, t });
    })
  );
});
