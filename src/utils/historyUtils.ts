import { createBrowserHistory, createMemoryHistory } from "history";

export const history =
  // Added check since the file is run within a node context when using @xstate/test and TestCafe
  typeof window !== "undefined" ? createBrowserHistory() : createMemoryHistory();
