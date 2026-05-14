require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

Pod::Spec.new do |s|
  s.name         = "OpentokReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/opentok/opentok-react-native.git", :tag => "#{s.version}" }

  # Generated codegen files are owned by ReactCodegen pod (via "Generate Specs" Xcode build phase).
  # Exclude ios/build/** to avoid duplicate symbol conflicts with ReactCodegen.
  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.exclude_files = "ios/build/**/*"
  s.public_header_files = "ios/**/*.h"

  # Add VonageClientSDKVideo dependency
  s.dependency 'VonageClientSDKVideo', '2.33.0'
  
  # Configure compiler flags and settings
  s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    "HEADER_SEARCH_PATHS" => [
      "\"$(PODS_ROOT)/boost\"",
      # Points to the app's RN codegen output dir, populated by ReactCodegen's "Generate Specs"
      # build phase (before_compile). Using the real directory (not Pods/Headers/Public symlinks)
      # ensures #pragma once correctly deduplicates headers across both search paths.
      "\"${PODS_ROOT}/../build/generated/ios\""
    ].join(" "),
    "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DFOLLY_CFG_NO_COROUTINES=1",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
  }
  
  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
    s.dependency "React-Codegen"
    s.dependency "RCT-Folly"
    s.dependency "RCTRequired"
    s.dependency "RCTTypeSafety"
    s.dependency "ReactCommon/turbomodule/core"
    
    s.script_phases = [
      {
        :name => 'Generate Specs',
        :script => '
cd "${PODS_ROOT}/../.."
node "${PODS_ROOT}/../node_modules/react-native/scripts/generate-codegen-artifacts.js" \\
  -p "${PODS_ROOT}/../node_modules/@vonage/client-sdk-video-react-native" \\
  -t ios \\
  -o "${PODS_ROOT}/../node_modules/@vonage/client-sdk-video-react-native/ios" \\
  -s library
        ',
        :execution_position => :before_compile,
        :input_files => ["${PODS_ROOT}/../node_modules/@vonage/client-sdk-video-react-native/package.json"],
        :output_files => ["${PODS_ROOT}/../node_modules/@vonage/client-sdk-video-react-native/ios/build/generated/ios/RNOpentokReactNativeSpec/RNOpentokReactNativeSpec.h"]
      }
    ]
  end
end
