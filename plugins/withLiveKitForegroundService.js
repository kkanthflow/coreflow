const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withLiveKitForegroundService(config) {
  // Add required permissions
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_CAMERA',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  ]);

  // Add services to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const hasSamiService = mainApplication.service.some(
      (s) => s.$['android:name'] === 'com.supersami.foregroundservice.ForegroundService'
    );

    if (!hasSamiService) {
      mainApplication.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundService',
          'android:foregroundServiceType': 'camera|microphone|mediaProjection',
        },
      });
      mainApplication.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundServiceTask',
        },
      });
    }

    return config;
  });

  return config;
};
