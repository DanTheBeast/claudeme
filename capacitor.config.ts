import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.danfields5454.callme",
  appName: "CallMe",
  webDir: "out",
  server: {
    // In production, the app loads from the local static export.
    // For development, uncomment the url below to use live reload:
    // url: "http://192.168.6.84:3000",
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#FFFFFF",
    scrollEnabled: true,
  },
  plugins: {
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FFFFFF",
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 500,
      backgroundColor: "#FDFBF9",
      showSpinner: false,
    },
  },
};

export default config;
