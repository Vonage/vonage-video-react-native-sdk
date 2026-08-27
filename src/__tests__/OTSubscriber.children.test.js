// Regression test: OTSubscriber.render called this.props.children(streams)
// unconditionally, so element (non-function) children threw
// "children is not a function". Non-function children should render the default
// subscriber views instead of crashing.
// See old repo opentok/opentok-react-native#956.

jest.mock('react-native', () => ({
  View: ({ children }) => children ?? null,
}));
jest.mock('../OT', () => ({ OT: {} }));
jest.mock(
  'deprecated-react-native-prop-types',
  () => ({ ViewPropTypes: { style: () => null } }),
  { virtual: true }
);
jest.mock('../OTSubscriberView', () => 'OTSubscriberView');

import React from 'react';
import OTSubscriber from '../OTSubscriber';

const makeSubscriber = (children) => {
  const sub = new OTSubscriber(
    { children, properties: {}, eventHandlers: {}, streamProperties: {}, containerStyle: {} },
    { sessionId: 'sid-1' }
  );
  sub.context = { sessionId: 'sid-1' };
  sub.state = { ...sub.state, streams: ['stream-1'] };
  return sub;
};

describe('OTSubscriber non-function children', () => {
  it('does not throw when children is a JSX element (renders default views)', () => {
    const sub = makeSubscriber(React.createElement('View', null));
    expect(() => sub.render()).not.toThrow();
  });

  it('does not throw when there are no children', () => {
    const sub = makeSubscriber(undefined);
    expect(() => sub.render()).not.toThrow();
  });

  it('still invokes a render-prop function child with the current streams', () => {
    const renderProp = jest.fn(() => null);
    const sub = makeSubscriber(renderProp);
    expect(() => sub.render()).not.toThrow();
    expect(renderProp).toHaveBeenCalledWith(['stream-1']);
  });
});
