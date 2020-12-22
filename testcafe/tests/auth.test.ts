import { XHRInterceptor } from "@smartive/testcafe-utils";
import { createTestPlans, StatesTestFunctions } from "@smartive/xstate-test-toolbox";
import { TestEventsConfig } from "@xstate/test/lib/types";
import { Selector } from "testcafe";
import { authMachine, AuthMachineContext } from "../../src/machines/authMachine";

type TestContext = {
  t: TestController;
  plan: string;
  path: string;
  meta: { now: string; username: string; password: string };
};

const xhrInterceptor = new XHRInterceptor({
  login: /.*http:\/\/localhost:3001\/login$/,
  checkAuth: { method: "GET", pattern: /.*http:\/\/localhost:3001\/checkAuth$/ },
  users: /.*http:\/\/localhost:3001\/users\/?.*/,
});

const tests: StatesTestFunctions<AuthMachineContext, TestContext> = {
  unauthorized: ({ t }) => t.expect(Selector('[data-test="signin-username"]').exists).ok(),
  signup: ({ t }) => t.expect(Selector('[data-test="signin-username"]').exists).ok(),
  loading: ({ t }) => t.expect(Selector('[data-test="auth-loading"]').exists).ok(),
  updating: ({ t }) => t.expect(Selector('[data-test="user-updating"]').exists).ok(),
  refreshing: ({ t }) => t.expect(Selector('[data-test="user-refreshing"]').exists).ok(),
  logout: ({ t }) => t.expect(Selector('[data-test="signin-username"]').exists).ok(),
  authorized: ({ t }) => t.expect(Selector('[data-test="main"]').exists).ok(),
};

const testEvents: TestEventsConfig<TestContext> = {
  LOGIN: ({ t, meta: { username, password } }) =>
    t
      .typeText('[data-test="signin-username"]', username)
      .typeText('[data-test="signin-password"]', password)
      .click('[data-test="signin-submit"]'),
  SIGNUP: ({ t, meta: { now } }) =>
    t
      .click('[data-test="signup"]')
      .typeText('[data-test="signup-first-name"]', `first-name-${now}`)
      .typeText('[data-test="signup-last-name"]', `last-name-${now}`)
      .typeText('[data-test="signup-username"]', `username-${now}`)
      .typeText('[data-test="signup-password"]', `password-${now}`)
      .typeText('[data-test="signup-confirmPassword"]', `password-${now}`)
      .click('[data-test="signup-submit"]')
      .expect(xhrInterceptor.resolve("users")({ t }))
      .ok("xhr resolved", { allowUnawaitedPromise: true }),
  LOGOUT: ({ t }) => t.click('[data-test="sidenav-signout"]'),
  UPDATE: ({ t, meta: { now } }) =>
    t
      .click('[data-test="sidenav-user-settings"]')
      .selectText('[data-test="user-settings-firstName-input"]')
      .pressKey("delete")
      .typeText('[data-test="user-settings-firstName-input"]', `${now}`)
      .click('[data-test="user-settings-submit"]'),
  REFRESH: ({ t }) =>
    t
      .click('[data-test="nav-top-new-transaction"]')
      .expect(xhrInterceptor.resolve("users")({ t }))
      .ok("xhr resolved", { allowUnawaitedPromise: true })
      .click('[data-test^="user-list-item-"]')
      .typeText('[data-test="transaction-create-amount-input"]', "12.50")
      .typeText('[data-test="transaction-create-description-input"]', "Cheap Pizza")
      .click('[data-test="transaction-create-submit-request"]'),
  "done.invoke.performLogin": xhrInterceptor.resolve("login"),
  "done.invoke.updateProfile": xhrInterceptor.resolve("users"),
  "done.invoke.getUserProfile": xhrInterceptor.resolve("checkAuth"),
};

createTestPlans({ machine: authMachine, tests, testEvents }).forEach(
  ({ description: plan, paths }) => {
    fixture(plan).page(`http://localhost:3000/signin`);

    const meta = {
      now: `${Date.now()}`,
      username: "Giovanna74",
      password: plan.includes('"unauthorized"') ? "wrong" : "s3cret",
    };

    paths.forEach(({ test: run, description: path }) =>
      test.clientScripts([xhrInterceptor.clientScript()])(`via ${path} ⬏`, (t) =>
        run({ plan, path, t, meta })
      )
    );
  }
);
