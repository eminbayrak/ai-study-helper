export default {
  expo: {
    // ... other config
    userInterfaceStyle: 'automatic',
    web: {
      favicon: "./assets/favicon.png",
      permissions: {
        camera: true,
        mediaLibrary: true,
      }
    },
    plugins: [
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to let you share them with your friends."
        }
      ]
    ]
  },
}; 