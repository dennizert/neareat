const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

function withFixedGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const keys = ['android.overridePathCheck', 'android.kotlinVersion'];
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || !keys.includes(item.key)
    );
    config.modResults.push(
      { type: 'property', key: 'android.overridePathCheck', value: 'true' },
      { type: 'property', key: 'android.kotlinVersion', value: '1.9.25' }
    );
    return config;
  });
}

function withPinnedKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      "classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}\")"
    );
    return config;
  });
}

module.exports = function withAndroidBuildFixes(config) {
  config = withFixedGradleProperties(config);
  config = withPinnedKotlinVersion(config);
  return config;
};
