import { Role } from "testcafe";

export const bankCustomer = Role("http://localhost:3000/signin", (t) =>
  t
    .typeText('[data-test="signin-username"]', "Giovanna74")
    .typeText('[data-test="signin-password"]', "s3cret")
    .click('[data-test="signin-submit"]')
);
