/** Every screen in the employee mobile app and the params it takes */
export type RootStackParamList = {
  Login: undefined;
  ResetPassword: undefined;
  ProfileCompletion: undefined;
  FaceRegistration: undefined;
  EmployeeHome: undefined;
  AttendanceHistory: undefined;
  Profile: undefined;
  Notifications: undefined;
};

// Makes useNavigation() / navigate() type-safe everywhere without extra generics.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
