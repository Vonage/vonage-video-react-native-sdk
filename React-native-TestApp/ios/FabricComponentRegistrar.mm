#import "FabricComponentRegistrar.h"
#import <React/RCTComponentViewFactory.h>
#import <OpentokReactNativeObjC/OTRNPublisherComponentView.h>
#import <OpentokReactNativeObjC/OTRNSubscriberComponentView.h>

@implementation FabricComponentRegistrar

+ (void)registerCustomComponents {
    RCTComponentViewFactory *factory = [RCTComponentViewFactory currentComponentViewFactory];
    [factory registerComponentViewClass:[OTRNPublisherComponentView class]];
    [factory registerComponentViewClass:[OTRNSubscriberComponentView class]];
}

@end
