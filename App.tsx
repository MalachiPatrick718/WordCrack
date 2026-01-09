import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import { AppRoot } from "./src/AppRoot";

export default function App() {
  return (
    <>
      <AppRoot />
      <StatusBar style="auto" />
    </>
  );
}
