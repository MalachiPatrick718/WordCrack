import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AppRoot } from "./src/AppRoot";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  return (
    <>
      <AppRoot />
      <StatusBar style="auto" />
    </>
  );
}
