/** Every screen in the app and the params it takes (none of them need params). */
export type RootStackParamList = {
  Login: undefined;
  ResetPassword: undefined;
  EmployeeHome: undefined;
  AdminHome: undefined;
  HrHome: undefined;
};

// Makes useNavigation() / navigate() type-safe everywhere without extra generics.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
