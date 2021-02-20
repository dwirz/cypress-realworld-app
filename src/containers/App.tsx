import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { useService, useMachine } from "@xstate/react";
import { makeStyles } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

import { snackbarMachine } from "../machines/snackbarMachine";
import { notificationsMachine } from "../machines/notificationsMachine";
import { authService } from "../machines/authMachine";
import AlertBar from "../components/AlertBar";
import SignInForm from "../components/SignInForm";
import SignUpForm from "../components/SignUpForm";
import { bankAccountsMachine } from "../machines/bankAccountsMachine";
import PrivateRoutesContainer from "./PrivateRoutesContainer";
import { inspect } from "@xstate/inspect";

// @ts-ignore
if (window.Cypress) {
  // Expose authService on window for Cypress
  // @ts-ignore
  window.authService = authService;
}

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
}));

// Added `inspect` to understand and visualize the machines of the real-world-app
const devTools = JSON.parse(
  typeof window !== "undefined" ? localStorage.getItem("__xstate.inspect") || "false" : "false"
);
if (devTools) {
  inspect({ iframe: false });
}

const App: React.FC = () => {
  const classes = useStyles();
  const [authState] = useService(authService);
  const [, , notificationsService] = useMachine(notificationsMachine, { devTools });

  const [, , snackbarService] = useMachine(snackbarMachine, { devTools });

  const [, , bankAccountsService] = useMachine(bankAccountsMachine, { devTools });

  const isLoggedIn =
    authState.matches("authorized") ||
    authState.matches("refreshing") ||
    authState.matches("updating");

  return (
    <div
      className={classes.root}
      // Added this to check whether the app is in the given state, it would be nicer
      // to somehow represent the given state within the UI as a specific component
      data-test={authState.matches("loading") ? "auth-loading" : undefined}
    >
      <CssBaseline />

      {isLoggedIn && (
        <PrivateRoutesContainer
          isLoggedIn={isLoggedIn}
          notificationsService={notificationsService}
          authService={authService}
          snackbarService={snackbarService}
          bankAccountsService={bankAccountsService}
        />
      )}
      {authState.matches("unauthorized") && (
        <Switch>
          <Route exact path="/signup">
            <SignUpForm authService={authService} />
          </Route>
          <Route exact path="/signin">
            <SignInForm authService={authService} />
          </Route>
          <Route path="/*">
            <Redirect
              to={{
                pathname: "/signin",
              }}
            />
          </Route>
        </Switch>
      )}
      <AlertBar snackbarService={snackbarService} />
    </div>
  );
};

export default App;
