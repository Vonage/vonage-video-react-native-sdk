import OTPublisherJS from './OTPublisher';
import OTSessionJS from './OTSession';
import OTSubscriberJS from './OTSubscriber';
import OTSubscriberViewJS from './OTSubscriberView';
import type { OTPublisherComponent,	OTSessionComponent,	OTSubscriberComponent, OTSubscriberViewComponent } from './types';

const OTSession = OTSessionJS as unknown as OTSessionComponent;
const OTSubscriber = OTSubscriberJS as unknown as OTSubscriberComponent;
const OTSubscriberView = OTSubscriberViewJS as unknown as OTSubscriberViewComponent;
const OTPublisher = OTPublisherJS as unknown as OTPublisherComponent;

export * from './types';
export { OTSession, OTSubscriber, OTSubscriberView, OTPublisher };
