/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Crônicas de Aventuras',
    slug: 'cronicas-aventuras',
    version: '1.0.0',
    sdkVersion: '54.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#05040a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.cronicasaventuras.app',
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      package: 'com.cronicasaventuras.app',
      adaptiveIcon: {
        backgroundColor: '#05040a',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      usesCleartextTraffic: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-secure-store'],
    extra: {
      webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'http://localhost:9002',
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8071/api',
    },
  },
};
