// We need to replace Java with Kotlin
// This file to add/migrate the Utility functions from Utils.java to Utils.kt

package com.opentokreactnative.utils

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.opentok.android.BaseVideoRenderer
import com.opentok.android.PublisherKit
import com.opentok.android.SubscriberKit
import com.opentok.android.TransportStats

fun String?.toVideoScaleType(): String = when (this) {
    "fit" -> BaseVideoRenderer.STYLE_VIDEO_FIT
    "fill" -> BaseVideoRenderer.STYLE_VIDEO_FILL
    else -> BaseVideoRenderer.STYLE_VIDEO_FILL
}

fun Int.toNetworkConditionString(): String = when (this) {
    TransportStats.NETWORK_CONDITION_CRITICAL -> "critical"
    TransportStats.NETWORK_CONDITION_WARNING -> "warning"
    TransportStats.NETWORK_CONDITION_FAIR -> "fair"
    TransportStats.NETWORK_CONDITION_GOOD -> "good"
    TransportStats.NETWORK_CONDITION_EXCELLENT -> "excellent"
    else -> "unknown"
}

fun String?.toNetworkConditionReasonString(): String = when (this) {
    TransportStats.NETWORK_CONDITION_REASON_NONE -> "none"
    TransportStats.NETWORK_CONDITION_REASON_BANDWIDTH -> "bandwidth"
    TransportStats.NETWORK_CONDITION_REASON_PACKET_LOSS -> "packetLoss"
    TransportStats.NETWORK_CONDITION_REASON_NO_SUBSCRIBERS -> "noSubscribers"
    TransportStats.NETWORK_CONDITION_REASON_DOWNSTREAM_CONSTRAINT -> "downstreamConstraint"
    else -> "unknown"
}

fun String?.toQualityLimitationReasonString(): String = when (this) {
    PublisherKit.VIDEO_REASON_QUALITY_DEGRADATION_BANDWIDTH -> "bandwidth"
    PublisherKit.VIDEO_REASON_QUALITY_DEGRADATION_CPU -> "cpu"
    PublisherKit.VIDEO_REASON_QUALITY_DEGRADATION_OTHER -> "other"
    else -> "none"
}

fun Int.toQualityRestrictionString(): String = when (this) {
    SubscriberKit.SubscriberVideoStats.QUALITY_RESTRICTION_NONE -> "none"
    SubscriberKit.SubscriberVideoStats.QUALITY_RESTRICTION_SPATIAL -> "spatial"
    SubscriberKit.SubscriberVideoStats.QUALITY_RESTRICTION_TEMPORAL -> "temporal"
    SubscriberKit.SubscriberVideoStats.QUALITY_RESTRICTION_SPATIAL_AND_TEMPORAL -> "spatialAndTemporal"
    else -> "unknown"
}

fun TransportStats.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putDouble("connectionEstimatedBandwidth", connectionEstimatedBandwidth.toDouble())
    putString("networkCondition", networkCondition.toNetworkConditionString())
    putString("networkConditionReason", networkConditionReason.toNetworkConditionReasonString())
}

fun PublisherKit.VideoLayerStats.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putInt("width", width)
    putInt("height", height)
    putDouble("encodedFrameRate", if (encodedFrameRate.isFinite()) encodedFrameRate else 0.0)
    putDouble("bitrate", bitrate.toDouble())
    putDouble("totalBitrate", totalBitrate.toDouble())
    putString("qualityLimitationReason", qualityLimitationReason.toQualityLimitationReasonString())
    scalabilityMode?.let { putString("scalabilityMode", it) }
    codec?.let { putString("codec", it) }
}
