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

  # Generate codegen files during pod install if not already generated
  s.prepare_command = <<-CMD
    cd ../../..
    if [ ! -d "node_modules/@vonage/client-sdk-video-react-native/ios/generated/RNOpentokReactNativeSpec" ]; then
      if [ -f "node_modules/react-native/scripts/generate-codegen-artifacts.js" ]; then
        echo "[Codegen] Generating specs for OpentokReactNative..."
        node node_modules/react-native/scripts/generate-codegen-artifacts.js \
          -p node_modules/@vonage/client-sdk-video-react-native \
          -t ios \
          -o node_modules/@vonage/client-sdk-video-react-native/ios \
          -s library
      fi
    fi
  CMD

  s.source_files = [
    "ios/*.{h,m,mm,swift}",
    "ios/Utils/**/*.{h,m,mm,swift}",
    "ios/generated/**/*.{h,mm,cpp,swift}"
  ]
  s.private_header_files = "ios/build/generated/ios/**/*.h"
  s.public_header_files = [
    "ios/OpentokReactNative.h",
    "ios/OTRNPublisherComponentView.h",
    "ios/OTRNSubscriberComponentView.h",
    "ios/OTScreenCapture.h"
  ]
  
  # Add VonageClientSDKVideo dependency
  s.dependency 'VonageClientSDKVideo', '2.33.0'
  
  # Configure compiler flags and settings
  s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => [
      "\"$(PODS_ROOT)/boost\"",
      "\"$(PODS_TARGET_SRCROOT)/ios/generated\"",
      "\"$(PODS_TARGET_SRCROOT)/ios/generated/RNOpentokReactNativeSpec\""
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
  end
end
