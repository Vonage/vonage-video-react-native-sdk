require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = "client-sdk-video-react-native"
  s.version       = package['version']
  s.summary       = package['description']
  s.license       = package['license']

  s.authors       = package['author']
  s.homepage      = package['homepage']
  s.platform      = :ios, "13.0"
  s.swift_version = "4.2"

  s.source        = { :git => "https://github.com/Vonage/vonage-video-react-native-sdk", :tag => "v#{s.version}" }
  s.source_files  = "ios/**/*.{h,m,swift}"

  s.dependency 'React'
  s.dependency 'VonageClientSDKVideo','2.30.1'
end
