type RtpSummary = {
  codec?: string;
  rid?: string;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  framesEncoded?: number;
  framesDecoded?: number;
  bytes?: number;
  targetBitrate?: number;
};

export type RtcStatsSummary = {
  reportCount: number;
  outboundVideo: RtpSummary[];
  outboundAudio: RtpSummary[];
  inboundVideo: RtpSummary[];
  inboundAudio: RtpSummary[];
};

const toReports = (raw: unknown): any[] => {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') return Object.values(parsed);
  return [];
};

/** Reduces a WebRTC stats report (JSON string or array) to the RTP fields the E2E tests read. */
export const summarizeRtcReports = (raw: unknown): RtcStatsSummary => {
  const reports = toReports(raw);
  const byId = new Map(reports.map((r) => [r.id, r]));
  const pick = (type: string, kind: string): RtpSummary[] =>
    reports
      .filter((r) => r.type === type && (r.kind ?? r.mediaType) === kind)
      .map((r) => ({
        codec: byId.get(r.codecId)?.mimeType,
        rid: r.rid,
        frameWidth: r.frameWidth,
        frameHeight: r.frameHeight,
        framesPerSecond: r.framesPerSecond,
        framesEncoded: r.framesEncoded,
        framesDecoded: r.framesDecoded,
        bytes: r.bytesSent ?? r.bytesReceived,
        targetBitrate: r.targetBitrate,
      }));
  return {
    reportCount: reports.length,
    outboundVideo: pick('outbound-rtp', 'video'),
    outboundAudio: pick('outbound-rtp', 'audio'),
    inboundVideo: pick('inbound-rtp', 'video'),
    inboundAudio: pick('inbound-rtp', 'audio'),
  };
};
