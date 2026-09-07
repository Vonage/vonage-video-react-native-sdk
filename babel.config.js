// The builder-bob preset compiles the published library; it does not strip the TS-style spec
// syntax (`interface … { readonly … }`) that React Native 0.87 ships in its own source (e.g.
// specs_DEPRECATED/*). Under jest, transform React Native's sources with @react-native/babel-preset
// instead, which understands that syntax. Builds are unaffected.
module.exports = (api) => {
  // Cache the resolved config per-environment so Babel doesn't re-evaluate this
  // function on every file (required when branching on api.env()).
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = api.env('test');
  return {
    presets: [
      isTest
        ? 'module:@react-native/babel-preset'
        : 'module:react-native-builder-bob/babel-preset',
    ],
  };
};
