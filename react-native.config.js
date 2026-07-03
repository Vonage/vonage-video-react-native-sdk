/**
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  dependency: {
    platforms: {
      // Pin the full package explicitly. The library ships several ReactPackage
      // classes (including the module-only OpentokReactNativePackage); without
      // this, autolinking picks one by a fragile file-scan heuristic and may
      // select the module-only package, leaving the OTRNPublisher/OTRNSubscriber
      // view managers unregistered ("Can't find ViewManager 'OTRNPublisher'").
      android: {
        packageImportPath: 'import com.opentokreactnative.OTRNPublisherPackage;',
        packageInstance: 'new OTRNPublisherPackage()',
      },
      ios: {},
    },
  },
};
