import React from "react";

import BankAccountItem from "./BankAccountItem";
import List from "@material-ui/core/List";
import { BankAccount } from "../models";
import EmptyList from "./EmptyList";

export interface BankAccountListProps {
  bankAccounts: BankAccount[];
  deleteBankAccount: Function;
}

const BankAccountList: React.FC<BankAccountListProps> = ({ bankAccounts, deleteBankAccount }) => {
  return (
    <>
      {bankAccounts?.length > 0 ? (
        <List data-test="bankaccount-list">
          {bankAccounts
            // Sorting the bank accounts to shuffle the deleted to the end within the list adding
            // this as a sort criteria which can be changed by the user would be nicer
            .sort((a, b) => (a.isDeleted === b.isDeleted ? 0 : b.isDeleted ? -1 : 1))
            .map((bankAccount: BankAccount) => (
              <BankAccountItem
                key={bankAccount.id}
                bankAccount={bankAccount}
                deleteBankAccount={deleteBankAccount}
              />
            ))}
        </List>
      ) : (
        <EmptyList entity="Bank Accounts" />
      )}
    </>
  );
};

export default BankAccountList;
